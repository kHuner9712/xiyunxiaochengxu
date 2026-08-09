import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import {
  FREIGHT_DEFAULT_FEE,
  FREIGHT_FREE_AMOUNT,
  FREIGHT_REMOTE_AREAS,
  FREIGHT_REMOTE_FEE,
  ORDER_AUTO_CLOSE_MINUTES,
  generateOrderNo,
  generatePaymentNo,
} from '@baby-mall/shared';
import { PAYMENT_STATUS } from '../common/constants/payment';
import { normalizeAssetUrl } from '../common/utils/asset-url';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { PrismaService } from '../common/prisma/prisma.service';
import { SystemConfigService } from '../system-config/system-config.service';
import { ActivityCheckoutDto } from './dto/activity-checkout.dto';

const ALLOWED_SOURCE_TYPES = new Set([
  'direct',
  'user_referral',
  'merchant_referral',
  'campaign',
]);

const DEFAULT_COVER_MARKER = '/uploads/static/default-cover.png';

type DbClient = PrismaService | Prisma.TransactionClient;

type LoadedLine = {
  activityProduct: any;
  sku: any;
  quantity: number;
  price: number;
  subtotal: number;
  originalSubtotal: number;
  activityDiscount: number;
  isGift: boolean;
};

type LoadedMultiOrder = {
  activity: any;
  lines: LoadedLine[];
  totalAmount: number;
  activityDiscountAmount: number;
  merchandisePayAmount: number;
  promotionLabel: string;
  maxQuantity: number;
};

@Injectable()
export class ActivityMultiItemCheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly systemConfigService: SystemConfigService,
  ) {}

  async preview(
    userId: bigint,
    activityId: bigint,
    anchorActivityProductId: bigint,
    anchorSkuId: bigint,
    dto: ActivityCheckoutDto,
  ) {
    const loaded = await this.loadAndValidate(
      this.prisma,
      userId,
      activityId,
      anchorActivityProductId,
      anchorSkuId,
      dto.quantity,
    );
    const fulfillmentType = this.resolveFulfillmentType(loaded.lines, dto.fulfillmentType);
    const [address, pickupStore] = await Promise.all([
      fulfillmentType === 'delivery' && dto.addressId
        ? this.prisma.userAddress.findFirst({
            where: {
              id: parsePositiveBigIntId(dto.addressId, '收货地址'),
              userId,
              deletedAt: null,
            },
          })
        : null,
      fulfillmentType === 'pickup' && dto.pickupStoreId
        ? this.prisma.pickupStore.findFirst({
            where: {
              id: parsePositiveBigIntId(dto.pickupStoreId, '自提点'),
              status: 1,
              deletedAt: null,
            },
          })
        : null,
    ]);
    this.assertFulfillmentSelection(fulfillmentType, address, pickupStore);

    const freightAmount = fulfillmentType === 'delivery'
      ? this.calculateFreight(loaded.merchandisePayAmount, address?.province)
      : 0;
    const payAmount = loaded.merchandisePayAmount + freightAmount;

    return {
      activityId: activityId.toString(),
      activityProductId: anchorActivityProductId.toString(),
      activityType: String(loaded.activity.type),
      promotionLabel: loaded.promotionLabel,
      items: loaded.lines.map((line) => ({
        activityProductId: line.activityProduct.id.toString(),
        productId: line.sku.productId.toString(),
        skuId: line.sku.id.toString(),
        productName: line.sku.product.name,
        productImage: this.pickOrderProductImage(line.sku.image, line.sku.product.mainImage),
        skuSpecs: line.sku.specs,
        skuSpecText: this.formatSpecs(line.sku.specs),
        price: line.price,
        originalPrice: line.sku.price,
        quantity: line.quantity,
        subtotal: line.subtotal,
        isGift: line.isGift,
      })),
      totalAmount: loaded.totalAmount,
      discountAmount: 0,
      couponAmount: 0,
      activityDiscountAmount: loaded.activityDiscountAmount,
      pointsAmount: 0,
      pointsDeducted: 0,
      availablePoints: 0,
      maxPointsDeduct: 0,
      pointsDeductRate: this.systemConfigService.getRuntimeConfig().pointsDeductRate,
      pointsDeductMaxPercent: 0,
      freightAmount,
      payAmount,
      fulfillmentType,
      isZeroPay: payAmount === 0,
      promotionStackingDisabled: true,
      maxQuantity: loaded.maxQuantity,
    };
  }

  async createOrder(
    userId: bigint,
    activityId: bigint,
    anchorActivityProductId: bigint,
    anchorSkuId: bigint,
    dto: ActivityCheckoutDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const userRows = await tx.$queryRaw<Array<{ id: bigint }>>`
        SELECT id FROM users
        WHERE id = ${userId} AND deleted_at IS NULL AND status = 1
        FOR UPDATE
      `;
      if (userRows.length === 0) throw new NotFoundException('用户不存在或已停用');
      await tx.$queryRaw`SELECT id FROM activities WHERE id = ${activityId} FOR UPDATE`;

      const loaded = await this.loadAndValidate(
        tx,
        userId,
        activityId,
        anchorActivityProductId,
        anchorSkuId,
        dto.quantity,
      );
      const fulfillmentType = this.resolveFulfillmentType(loaded.lines, dto.fulfillmentType);
      const addressId = fulfillmentType === 'delivery'
        ? parsePositiveBigIntId(dto.addressId, '收货地址')
        : null;
      const pickupStoreId = fulfillmentType === 'pickup'
        ? parsePositiveBigIntId(dto.pickupStoreId, '自提点')
        : null;
      const [address, pickupStore] = await Promise.all([
        fulfillmentType === 'delivery'
          ? tx.userAddress.findFirst({
              where: { id: addressId!, userId, deletedAt: null },
            })
          : null,
        fulfillmentType === 'pickup'
          ? tx.pickupStore.findFirst({
              where: { id: pickupStoreId!, status: 1, deletedAt: null },
            })
          : null,
      ]);
      this.assertFulfillmentSelection(fulfillmentType, address, pickupStore);

      // Sort stock claims by SKU id so concurrent bundle orders acquire rows in a stable order.
      const sortedLines = [...loaded.lines].sort((a, b) =>
        a.sku.id < b.sku.id ? -1 : a.sku.id > b.sku.id ? 1 : 0,
      );
      for (const line of sortedLines) {
        const stockClaim = await tx.productSku.updateMany({
          where: {
            id: line.sku.id,
            status: 1,
            stock: { gte: line.quantity },
          },
          data: {
            stock: { decrement: line.quantity },
            sales: { increment: line.quantity },
          },
        });
        if (stockClaim.count !== 1) {
          throw new BadRequestException(`${line.sku.product.name}库存不足，下单失败`);
        }
        const after = await tx.productSku.findUnique({
          where: { id: line.sku.id },
          select: { stock: true },
        });
        if (!after) throw new BadRequestException('SKU不存在，下单失败');
        await tx.productStockLog.create({
          data: {
            productId: line.sku.productId,
            skuId: line.sku.id,
            type: 1,
            quantity: line.quantity,
            beforeStock: after.stock + line.quantity,
            afterStock: after.stock,
            reason: `${loaded.promotionLabel}订单预扣库存`,
          },
        });
      }

      const freightAmount = fulfillmentType === 'delivery'
        ? this.calculateFreight(loaded.merchandisePayAmount, address?.province)
        : 0;
      const payAmount = loaded.merchandisePayAmount + freightAmount;
      const isZeroPay = payAmount === 0;
      const status = isZeroPay
        ? fulfillmentType === 'pickup'
          ? OrderStatus.pending_pickup
          : OrderStatus.pending_delivery
        : OrderStatus.pending_payment;
      const configuredCloseMinutes = this.systemConfigService.getRuntimeConfig().orderAutoCloseMinutes
        ?? ORDER_AUTO_CLOSE_MINUTES;
      const autoCloseAt = new Date(Date.now() + configuredCloseMinutes * 60 * 1000);
      const sourceType = dto.sourceType && ALLOWED_SOURCE_TYPES.has(dto.sourceType)
        ? dto.sourceType
        : 'direct';
      const sourceCode = dto.sourceCode?.trim() || null;
      const referrerUserId = dto.referrerUserId
        ? parsePositiveBigIntId(dto.referrerUserId, '推荐人用户')
        : null;
      const pickupCode = isZeroPay && fulfillmentType === 'pickup'
        ? await this.generatePickupCode(tx)
        : null;

      const order = await tx.order.create({
        data: {
          orderNo: generateOrderNo(),
          userId,
          status,
          totalAmount: loaded.totalAmount,
          discountAmount: 0,
          freightAmount,
          pointsAmount: 0,
          payAmount,
          pointsDeducted: 0,
          couponId: null,
          couponAmount: 0,
          activityDiscountAmount: loaded.activityDiscountAmount,
          fulfillmentType,
          sourceType,
          sourceCode,
          referrerUserId,
          receiverName: address?.receiverName ?? '',
          receiverPhone: address?.receiverPhone ?? '',
          province: address?.province ?? null,
          city: address?.city ?? null,
          district: address?.district ?? null,
          detailAddress: address?.detailAddress ?? null,
          pickupStoreId: pickupStore?.id ?? null,
          pickupStoreName: pickupStore?.name ?? null,
          pickupStoreAddress: pickupStore
            ? `${pickupStore.province}${pickupStore.city}${pickupStore.district}${pickupStore.address}`
            : null,
          pickupContactPhone: pickupStore?.contactPhone ?? null,
          pickupCode,
          remark: dto.remark,
          ...(isZeroPay ? { paidAt: new Date() } : { autoCloseAt }),
          orderItems: {
            create: loaded.lines.map((line) => ({
              productId: line.sku.productId,
              skuId: line.sku.id,
              productName: line.sku.product.name,
              skuSpecs: line.sku.specs === null
                ? Prisma.JsonNull
                : (line.sku.specs as Prisma.InputJsonValue),
              productImage: this.pickOrderProductImage(line.sku.image, line.sku.product.mainImage),
              price: line.price,
              originalPrice: line.sku.price,
              quantity: line.quantity,
              subtotal: line.subtotal,
              activityId,
              activityType: 'activity',
              activityDiscount: line.activityDiscount,
              supplierId: line.sku.product.supplierId,
            })),
          },
          orderLogs: {
            create: {
              operatorType: 'user',
              operatorId: userId,
              action: 'create',
              content: `${loaded.promotionLabel}下单`,
            },
          },
        },
        include: { orderItems: true },
      });
      if (order.orderItems.length !== loaded.lines.length) {
        throw new InternalServerErrorException('活动订单项创建不完整');
      }

      let paymentCreated = false;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await tx.orderPayment.create({
            data: {
              orderId: order.id,
              paymentNo: generatePaymentNo(),
              amount: payAmount,
              paymentMethod: isZeroPay ? 'zero_pay' : 'wechat',
              status: isZeroPay ? PAYMENT_STATUS.SUCCESS : PAYMENT_STATUS.CREATED,
              ...(isZeroPay ? { paidAt: new Date() } : {}),
            },
          });
          paymentCreated = true;
          break;
        } catch (error: any) {
          if (error?.code === 'P2002') continue;
          throw error;
        }
      }
      if (!paymentCreated) throw new InternalServerErrorException('支付单号生成失败，请重试');

      if (isZeroPay) {
        await tx.orderLog.create({
          data: {
            orderId: order.id,
            operatorType: 'system',
            action: 'pay_zero_amount',
            content: `0元${loaded.promotionLabel}订单自动支付成功`,
          },
        });
      }

      await tx.cart.deleteMany({
        where: { userId, skuId: { in: loaded.lines.map((line) => line.sku.id) } },
      });

      return {
        orderId: order.id.toString(),
        orderNo: order.orderNo,
        payAmount,
        isZeroPay,
        status,
        fulfillmentType,
        activityId: activityId.toString(),
        activityProductId: anchorActivityProductId.toString(),
      };
    });
  }

  private async loadAndValidate(
    client: DbClient,
    userId: bigint,
    activityId: bigint,
    anchorActivityProductId: bigint,
    anchorSkuId: bigint,
    quantity: number,
  ): Promise<LoadedMultiOrder> {
    if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 99) {
      throw new BadRequestException('活动购买数量必须为1-99的整数');
    }
    const now = new Date();
    const activity = await (client as any).activity.findUnique({ where: { id: activityId } });
    if (!activity || activity.status !== 1 || now < activity.startTime || now > activity.endTime) {
      throw new BadRequestException('活动不存在、未开始或已结束');
    }
    const activityType = String(activity.type);
    if (activityType !== '3' && activityType !== '4') {
      throw new BadRequestException('该活动不是满赠或组合套餐');
    }

    const relations = await (client as any).activityProduct.findMany({
      where: { activityId },
      orderBy: { id: 'asc' },
    });
    if (relations.length === 0) throw new BadRequestException('活动未配置商品');
    const anchor = relations.find((item: any) => item.id === anchorActivityProductId);
    if (!anchor || !anchor.skuId || anchor.skuId !== anchorSkuId) {
      throw new BadRequestException('所选SKU不属于该活动商品');
    }

    const skuIds = Array.from(new Set(relations
      .map((item: any) => item.skuId)
      .filter((id: bigint | null) => Boolean(id)))) as bigint[];
    const skus = await (client as any).productSku.findMany({
      where: { id: { in: skuIds }, status: 1 },
      include: { product: true },
    });
    const skuMap = new Map<string, any>(skus.map((sku: any) => [sku.id.toString(), sku]));
    const relationMap = new Map<string, any>(relations
      .filter((item: any) => item.skuId)
      .map((item: any) => [item.skuId.toString(), item]));

    for (const relation of relations) {
      if (!relation.skuId) throw new BadRequestException('活动商品必须绑定具体SKU');
      const sku = skuMap.get(relation.skuId.toString());
      if (!sku || sku.product.status !== 1) {
        throw new BadRequestException('活动包含已下架或无效SKU，请先修复活动配置');
      }
    }

    const rules = this.parseRules(activity.rules);
    if (activityType === '3') {
      return this.buildFullGiftOrder(
        client,
        userId,
        activity,
        anchor,
        skuMap,
        relationMap,
        rules,
        quantity,
      );
    }
    return this.buildBundleOrder(
      client,
      userId,
      activity,
      anchor,
      skuMap,
      relationMap,
      rules,
      quantity,
    );
  }

  private async buildFullGiftOrder(
    client: DbClient,
    userId: bigint,
    activity: any,
    anchor: any,
    skuMap: Map<string, any>,
    relationMap: Map<string, any>,
    rules: any,
    quantity: number,
  ): Promise<LoadedMultiOrder> {
    const paidSku = skuMap.get(anchor.skuId.toString());
    if (!paidSku) throw new BadRequestException('满赠主商品SKU无效');
    if (paidSku.stock < quantity) throw new BadRequestException('活动商品库存不足');
    await this.assertActivityQuota(client, activity.id, anchor, userId, quantity);

    const paidAmount = paidSku.price * quantity;
    const fullGiftRules = Array.isArray(rules.fullGiftRules) ? rules.fullGiftRules : [];
    const normalized = fullGiftRules
      .map((rule: any) => ({
        fullAmount: Number(rule?.fullAmount),
        giftSkuId: String(rule?.giftSkuId || ''),
        giftQuantity: Number(rule?.giftQuantity),
      }))
      .filter((rule: any) =>
        Number.isSafeInteger(rule.fullAmount) && rule.fullAmount > 0 &&
        /^[1-9]\d*$/.test(rule.giftSkuId) &&
        Number.isSafeInteger(rule.giftQuantity) && rule.giftQuantity > 0 && rule.giftQuantity <= 99,
      )
      .sort((a: any, b: any) => b.fullAmount - a.fullAmount);
    if (normalized.length === 0) throw new BadRequestException('满赠活动未配置有效赠品规则');

    const matched = normalized.find((rule: any) => paidAmount >= rule.fullAmount);
    const lines: LoadedLine[] = [{
      activityProduct: anchor,
      sku: paidSku,
      quantity,
      price: paidSku.price,
      subtotal: paidAmount,
      originalSubtotal: paidAmount,
      activityDiscount: 0,
      isGift: false,
    }];

    let giftValue = 0;
    if (matched) {
      const giftRelation = relationMap.get(matched.giftSkuId);
      const giftSku = skuMap.get(matched.giftSkuId);
      if (!giftRelation || !giftSku) {
        throw new BadRequestException('满赠规则中的赠品SKU未加入当前活动或已下架');
      }
      if (giftSku.product.fulfillmentType !== paidSku.product.fulfillmentType) {
        throw new BadRequestException('满赠商品与赠品必须使用相同履约方式');
      }
      if (giftSku.stock < matched.giftQuantity) throw new BadRequestException('赠品库存不足');
      await this.assertActivityQuota(
        client,
        activity.id,
        giftRelation,
        userId,
        matched.giftQuantity,
      );
      giftValue = giftSku.price * matched.giftQuantity;
      lines.push({
        activityProduct: giftRelation,
        sku: giftSku,
        quantity: matched.giftQuantity,
        price: 0,
        subtotal: 0,
        originalSubtotal: giftValue,
        activityDiscount: giftValue,
        isGift: true,
      });
    }

    const maxQuantity = await this.resolveSingleProductMaxQuantity(
      client,
      activity.id,
      anchor,
      userId,
      paidSku.stock,
    );
    return {
      activity,
      lines,
      totalAmount: paidAmount + giftValue,
      activityDiscountAmount: giftValue,
      merchandisePayAmount: paidAmount,
      promotionLabel: matched ? '满赠活动' : '满赠活动（未达赠品门槛）',
      maxQuantity,
    };
  }

  private async buildBundleOrder(
    client: DbClient,
    userId: bigint,
    activity: any,
    anchor: any,
    skuMap: Map<string, any>,
    relationMap: Map<string, any>,
    rules: any,
    bundleCount: number,
  ): Promise<LoadedMultiOrder> {
    const bundlePrice = Number(rules.bundlePrice);
    if (!Number.isSafeInteger(bundlePrice) || bundlePrice < 0) {
      throw new BadRequestException('组合套餐未配置有效套餐价');
    }
    const configuredItems = Array.isArray(rules.bundleItems) ? rules.bundleItems : [];
    const normalizedItems = configuredItems
      .map((item: any) => ({
        skuId: String(item?.skuId || ''),
        quantity: Number(item?.quantity),
      }))
      .filter((item: any) =>
        /^[1-9]\d*$/.test(item.skuId) &&
        Number.isSafeInteger(item.quantity) && item.quantity > 0 && item.quantity <= 99,
      );
    if (normalizedItems.length < 2) {
      throw new BadRequestException('组合套餐至少需要配置2个SKU及对应套餐数量');
    }
    const duplicateCheck = new Set(normalizedItems.map((item: any) => item.skuId));
    if (duplicateCheck.size !== normalizedItems.length) {
      throw new BadRequestException('组合套餐不能重复配置同一SKU');
    }
    if (!duplicateCheck.has(anchor.skuId.toString())) {
      throw new BadRequestException('套餐入口SKU不属于当前套餐');
    }

    const baseLines: Array<{ relation: any; sku: any; quantity: number; originalSubtotal: number }> = [];
    for (const item of normalizedItems) {
      const relation = relationMap.get(item.skuId);
      const sku = skuMap.get(item.skuId);
      if (!relation || !sku) throw new BadRequestException('组合套餐包含未加入活动或已下架SKU');
      const lineQuantity = item.quantity * bundleCount;
      if (!Number.isSafeInteger(lineQuantity) || lineQuantity <= 0 || lineQuantity > 9999) {
        throw new BadRequestException('组合套餐购买数量过大');
      }
      if (sku.stock < lineQuantity) throw new BadRequestException(`${sku.product.name}库存不足`);
      await this.assertActivityQuota(client, activity.id, relation, userId, lineQuantity);
      baseLines.push({
        relation,
        sku,
        quantity: lineQuantity,
        originalSubtotal: sku.price * lineQuantity,
      });
    }

    const fulfillmentTypes = new Set(baseLines.map((line) => line.sku.product.fulfillmentType || 'delivery'));
    if (fulfillmentTypes.size !== 1) {
      throw new BadRequestException('组合套餐内商品必须使用相同履约方式');
    }

    const originalTotal = baseLines.reduce((sum, line) => sum + line.originalSubtotal, 0);
    const bundlePayAmount = bundlePrice * bundleCount;
    if (!Number.isSafeInteger(bundlePayAmount) || bundlePayAmount > originalTotal) {
      throw new BadRequestException('组合套餐价不能高于套餐商品原价合计');
    }

    let allocated = 0;
    const lines: LoadedLine[] = baseLines.map((line, index) => {
      const isLast = index === baseLines.length - 1;
      const subtotal = isLast
        ? bundlePayAmount - allocated
        : Math.floor(bundlePayAmount * line.originalSubtotal / originalTotal);
      allocated += subtotal;
      const price = Math.floor(subtotal / line.quantity);
      return {
        activityProduct: line.relation,
        sku: line.sku,
        quantity: line.quantity,
        price,
        subtotal,
        originalSubtotal: line.originalSubtotal,
        activityDiscount: line.originalSubtotal - subtotal,
        isGift: false,
      };
    });

    const maxQuantity = await this.resolveBundleMaxQuantity(
      client,
      activity.id,
      userId,
      normalizedItems,
      relationMap,
      skuMap,
    );
    return {
      activity,
      lines,
      totalAmount: originalTotal,
      activityDiscountAmount: originalTotal - bundlePayAmount,
      merchandisePayAmount: bundlePayAmount,
      promotionLabel: '组合套餐',
      maxQuantity,
    };
  }

  private async assertActivityQuota(
    client: DbClient,
    activityId: bigint,
    relation: any,
    userId: bigint,
    quantity: number,
  ) {
    const skuId = relation.skuId as bigint;
    const [soldRows, userRows] = await Promise.all([
      (client as any).$queryRaw<Array<{ quantity: bigint | number | string }>>`
        SELECT COALESCE(SUM(oi.quantity), 0) AS quantity
        FROM order_items oi
        INNER JOIN orders o ON o.id = oi.order_id
        WHERE oi.activity_id = ${activityId}
          AND oi.activity_type = 'activity'
          AND oi.sku_id = ${skuId}
          AND o.status <> 'cancelled'
      `,
      (client as any).$queryRaw<Array<{ quantity: bigint | number | string }>>`
        SELECT COALESCE(SUM(oi.quantity), 0) AS quantity
        FROM order_items oi
        INNER JOIN orders o ON o.id = oi.order_id
        WHERE oi.activity_id = ${activityId}
          AND oi.activity_type = 'activity'
          AND oi.sku_id = ${skuId}
          AND o.user_id = ${userId}
          AND o.status <> 'cancelled'
      `,
    ]);
    const sold = Number(soldRows[0]?.quantity ?? 0);
    const boughtByUser = Number(userRows[0]?.quantity ?? 0);
    const activityStock = Number(relation.activityStock ?? 0);
    const limitPerUser = Number(relation.limitPerUser ?? 0);
    if (!Number.isSafeInteger(sold) || sold < 0 || !Number.isSafeInteger(boughtByUser) || boughtByUser < 0) {
      throw new BadRequestException('活动销量状态异常，请稍后重试');
    }
    if (!Number.isSafeInteger(activityStock) || activityStock <= 0 || sold + quantity > activityStock) {
      throw new BadRequestException('活动库存不足');
    }
    if (limitPerUser > 0 && boughtByUser + quantity > limitPerUser) {
      throw new BadRequestException(`每位用户最多购买${limitPerUser}件该活动SKU`);
    }
  }

  private async resolveSingleProductMaxQuantity(
    client: DbClient,
    activityId: bigint,
    relation: any,
    userId: bigint,
    skuStock: number,
  ) {
    const skuId = relation.skuId as bigint;
    const [soldRows, userRows] = await Promise.all([
      (client as any).$queryRaw<Array<{ quantity: bigint | number | string }>>`
        SELECT COALESCE(SUM(oi.quantity), 0) AS quantity
        FROM order_items oi INNER JOIN orders o ON o.id = oi.order_id
        WHERE oi.activity_id = ${activityId} AND oi.activity_type = 'activity'
          AND oi.sku_id = ${skuId} AND o.status <> 'cancelled'
      `,
      (client as any).$queryRaw<Array<{ quantity: bigint | number | string }>>`
        SELECT COALESCE(SUM(oi.quantity), 0) AS quantity
        FROM order_items oi INNER JOIN orders o ON o.id = oi.order_id
        WHERE oi.activity_id = ${activityId} AND oi.activity_type = 'activity'
          AND oi.sku_id = ${skuId} AND o.user_id = ${userId} AND o.status <> 'cancelled'
      `,
    ]);
    const remainingActivity = Math.max(0, Number(relation.activityStock || 0) - Number(soldRows[0]?.quantity || 0));
    const limit = Number(relation.limitPerUser || 0);
    const remainingUser = limit > 0
      ? Math.max(0, limit - Number(userRows[0]?.quantity || 0))
      : 99;
    return Math.max(0, Math.min(99, skuStock, remainingActivity, remainingUser));
  }

  private async resolveBundleMaxQuantity(
    client: DbClient,
    activityId: bigint,
    userId: bigint,
    items: Array<{ skuId: string; quantity: number }>,
    relationMap: Map<string, any>,
    skuMap: Map<string, any>,
  ) {
    let max = 99;
    for (const item of items) {
      const relation = relationMap.get(item.skuId);
      const sku = skuMap.get(item.skuId);
      if (!relation || !sku) return 0;
      const physicalMax = Math.floor(sku.stock / item.quantity);
      const quotaMaxUnits = await this.resolveSingleProductMaxQuantity(
        client,
        activityId,
        relation,
        userId,
        sku.stock,
      );
      max = Math.min(max, physicalMax, Math.floor(quotaMaxUnits / item.quantity));
    }
    return Math.max(0, max);
  }

  private resolveFulfillmentType(lines: LoadedLine[], requested?: string) {
    const types = new Set(lines.map((line) => line.sku.product.fulfillmentType || 'delivery'));
    if (types.size !== 1) throw new BadRequestException('活动订单中的商品履约方式不一致');
    const required = [...types][0] as string;
    if (required !== 'delivery' && required !== 'pickup') {
      throw new BadRequestException('活动商品履约方式无效');
    }
    const resolved = requested || required;
    if (resolved !== required) {
      throw new BadRequestException(required === 'pickup' ? '该活动仅支持到店自提' : '该活动仅支持快递配送');
    }
    return required as 'delivery' | 'pickup';
  }

  private assertFulfillmentSelection(
    fulfillmentType: 'delivery' | 'pickup',
    address: any,
    pickupStore: any,
  ) {
    if (fulfillmentType === 'delivery' && !address) throw new BadRequestException('请选择有效收货地址');
    if (fulfillmentType === 'pickup' && !pickupStore) throw new BadRequestException('请选择有效自提点');
  }

  private parseRules(raw: unknown) {
    if (!raw) return {};
    if (typeof raw === 'string') {
      try { return JSON.parse(raw); } catch { throw new BadRequestException('活动规则配置损坏'); }
    }
    if (typeof raw !== 'object') throw new BadRequestException('活动规则配置无效');
    return raw as Record<string, unknown>;
  }

  private calculateFreight(amount: number, province?: string) {
    const config = this.systemConfigService.getRuntimeConfig();
    const freeShippingAmount = config.freeShippingAmount ?? FREIGHT_FREE_AMOUNT;
    const defaultFreight = config.defaultFreight ?? FREIGHT_DEFAULT_FEE;
    if (amount >= freeShippingAmount) return 0;
    if (province && FREIGHT_REMOTE_AREAS.some((area) => province.includes(area))) return FREIGHT_REMOTE_FEE;
    return defaultFreight;
  }

  private pickOrderProductImage(skuImage?: string | null, productMainImage?: string | null) {
    const cleanSkuImage = typeof skuImage === 'string' ? skuImage.trim() : '';
    const cleanProductMainImage = typeof productMainImage === 'string' ? productMainImage.trim() : '';
    const candidate = cleanSkuImage && !cleanSkuImage.includes(DEFAULT_COVER_MARKER)
      ? cleanSkuImage
      : cleanProductMainImage;
    return normalizeAssetUrl(candidate || '');
  }

  private formatSpecs(specs: unknown) {
    if (!specs) return '';
    if (typeof specs === 'string') return specs;
    if (Array.isArray(specs)) return specs.join(' / ');
    if (typeof specs === 'object') return Object.values(specs as Record<string, unknown>).join(' / ');
    return String(specs);
  }

  private async generatePickupCode(tx: Prisma.TransactionClient) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const code = String(crypto.randomInt(10000000, 100000000));
      const exists = await tx.order.findFirst({ where: { pickupCode: code }, select: { id: true } });
      if (!exists) return code;
    }
    throw new InternalServerErrorException('自提码生成失败，请重试');
  }
}
