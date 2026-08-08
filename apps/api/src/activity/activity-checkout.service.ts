import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  FREIGHT_DEFAULT_FEE,
  FREIGHT_FREE_AMOUNT,
  FREIGHT_REMOTE_AREAS,
  FREIGHT_REMOTE_FEE,
} from '@baby-mall/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { PromotionCheckoutService } from '../order/promotion-checkout.service';
import { SystemConfigService } from '../system-config/system-config.service';
import { ActivityCheckoutDto } from './dto/activity-checkout.dto';

const CHECKOUT_ACTIVITY_TYPES = new Set(['1', '2', '5']);

type LoadedActivity = {
  activity: any;
  activityProduct: any;
  sku: any;
  discountAmount: number;
  effectiveUnitPrice: number;
  promotionLabel: string;
};

type QuotaQueryClient = Pick<Prisma.TransactionClient, '$queryRaw'>;

@Injectable()
export class ActivityCheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly promotionCheckoutService: PromotionCheckoutService,
    private readonly systemConfigService: SystemConfigService,
  ) {}

  async preview(userId: string, activityId: string, dto: ActivityCheckoutDto) {
    const userIdValue = parsePositiveBigIntId(userId, '用户');
    const activityIdValue = parsePositiveBigIntId(activityId, '活动');
    const activityProductId = parsePositiveBigIntId(dto.activityProductId, '活动商品');
    const skuId = parsePositiveBigIntId(dto.skuId, 'SKU');
    const loaded = await this.loadAndValidate(
      this.prisma,
      userIdValue,
      activityIdValue,
      activityProductId,
      skuId,
      dto.quantity,
    );

    const fulfillmentType = dto.fulfillmentType || loaded.sku.product.fulfillmentType || 'delivery';
    const [address, pickupStore] = await Promise.all([
      fulfillmentType === 'delivery' && dto.addressId
        ? this.prisma.userAddress.findFirst({
            where: {
              id: parsePositiveBigIntId(dto.addressId, '收货地址'),
              userId: userIdValue,
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
    this.assertFulfillment(fulfillmentType, loaded.sku.product.fulfillmentType, address, pickupStore);

    const totalAmount = loaded.sku.price * dto.quantity;
    const freightAmount = fulfillmentType === 'delivery'
      ? this.calculateFreight(totalAmount, address?.province)
      : 0;
    const payAmount = Math.max(0, totalAmount - loaded.discountAmount + freightAmount);

    return {
      activityId: activityIdValue.toString(),
      activityProductId: activityProductId.toString(),
      activityType: loaded.activity.type,
      promotionLabel: loaded.promotionLabel,
      items: [{
        productId: loaded.sku.productId.toString(),
        skuId: loaded.sku.id.toString(),
        productName: loaded.sku.product.name,
        productImage: loaded.sku.image || loaded.sku.product.mainImage || '',
        skuSpecs: loaded.sku.specs,
        skuSpecText: this.formatSpecs(loaded.sku.specs),
        price: loaded.activity.type === '2' ? loaded.sku.price : loaded.effectiveUnitPrice,
        originalPrice: loaded.sku.price,
        quantity: dto.quantity,
        subtotal: totalAmount - loaded.discountAmount,
      }],
      totalAmount,
      discountAmount: 0,
      couponAmount: 0,
      activityDiscountAmount: loaded.discountAmount,
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
    };
  }

  async createOrder(userId: string, activityId: string, dto: ActivityCheckoutDto) {
    const userIdValue = parsePositiveBigIntId(userId, '用户');
    const activityIdValue = parsePositiveBigIntId(activityId, '活动');
    const activityProductId = parsePositiveBigIntId(dto.activityProductId, '活动商品');
    const skuId = parsePositiveBigIntId(dto.skuId, 'SKU');

    const result = await this.prisma.$transaction(async (tx) => {
      const userRows = await tx.$queryRaw<Array<{ id: bigint }>>`
        SELECT id FROM users WHERE id = ${userIdValue} AND deleted_at IS NULL FOR UPDATE
      `;
      if (userRows.length === 0) throw new NotFoundException('用户不存在');
      await tx.$queryRaw`SELECT id FROM activities WHERE id = ${activityIdValue} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM activity_products WHERE id = ${activityProductId} FOR UPDATE`;

      const loaded = await this.loadAndValidate(
        tx,
        userIdValue,
        activityIdValue,
        activityProductId,
        skuId,
        dto.quantity,
      );

      const fulfillmentType = dto.fulfillmentType || loaded.sku.product.fulfillmentType || 'delivery';
      return this.promotionCheckoutService.createOrder(tx, {
        userId: userIdValue,
        skuId,
        quantity: dto.quantity,
        unitPrice: loaded.effectiveUnitPrice,
        activityId: activityIdValue,
        activityType: 'activity',
        ...(loaded.activity.type === '2'
          ? { promotionDiscountAmount: loaded.discountAmount }
          : {}),
        promotionLabel: loaded.promotionLabel,
        addressId: dto.addressId,
        pickupStoreId: dto.pickupStoreId,
        fulfillmentType,
        sourceType: dto.sourceType,
        sourceCode: dto.sourceCode,
        referrerUserId: dto.referrerUserId,
        remark: dto.remark,
      });
    });

    return {
      orderId: result.orderId.toString(),
      orderNo: result.orderNo,
      payAmount: result.payAmount,
      isZeroPay: result.isZeroPay,
      status: result.status,
      fulfillmentType: result.fulfillmentType,
      activityId: activityIdValue.toString(),
      activityProductId: activityProductId.toString(),
    };
  }

  private async loadAndValidate(
    client: PrismaService | Prisma.TransactionClient,
    userId: bigint,
    activityId: bigint,
    activityProductId: bigint,
    skuId: bigint,
    quantity: number,
  ): Promise<LoadedActivity> {
    if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 99) {
      throw new BadRequestException('活动购买数量必须为1-99的整数');
    }
    const now = new Date();
    const activity = await (client as any).activity.findUnique({ where: { id: activityId } });
    if (
      !activity ||
      activity.status !== 1 ||
      now < activity.startTime ||
      now > activity.endTime
    ) {
      throw new BadRequestException('活动不存在、未开始或已结束');
    }
    if (!CHECKOUT_ACTIVITY_TYPES.has(String(activity.type))) {
      throw new BadRequestException('该活动类型没有完整的可执行结算规则，不能下单');
    }

    const activityProduct = await (client as any).activityProduct.findFirst({
      where: { id: activityProductId, activityId },
    });
    if (!activityProduct) throw new NotFoundException('活动商品不存在');
    if (!activityProduct.skuId || activityProduct.skuId !== skuId) {
      throw new BadRequestException('所选SKU不属于该活动商品');
    }

    const sku = await (client as any).productSku.findFirst({
      where: {
        id: skuId,
        productId: activityProduct.productId,
        status: 1,
      },
      include: { product: true },
    });
    if (!sku || sku.product.status !== 1) throw new NotFoundException('活动商品规格不存在或已下架');
    if (sku.stock < quantity) throw new BadRequestException('活动商品库存不足');

    await this.assertActivityQuota(client as QuotaQueryClient, activity, activityProduct, skuId, userId, quantity);

    if (String(activity.type) === '5') {
      const usedNewUserActivity = await (client as any).orderItem.count({
        where: {
          activityId,
          activityType: 'activity',
          order: { userId, status: { not: 'cancelled' } },
        },
      });
      const previousPaidOrders = await (client as any).order.count({
        where: {
          userId,
          status: { notIn: ['pending_payment', 'cancelled'] },
        },
      });
      if (usedNewUserActivity > 0 || previousPaidOrders > 0) {
        throw new BadRequestException('该活动仅限尚未完成首笔有效订单的新用户');
      }
    }

    let effectiveUnitPrice = sku.price;
    let discountAmount = 0;
    let promotionLabel = '活动';
    if (String(activity.type) === '1') {
      effectiveUnitPrice = Number(activityProduct.activityPrice);
      if (!Number.isSafeInteger(effectiveUnitPrice) || effectiveUnitPrice < 0 || effectiveUnitPrice > sku.price) {
        throw new BadRequestException('限时折扣活动价无效');
      }
      discountAmount = (sku.price - effectiveUnitPrice) * quantity;
      promotionLabel = '限时折扣';
    } else if (String(activity.type) === '2') {
      const originalAmount = sku.price * quantity;
      discountAmount = this.resolveFullReduction(activity.rules, originalAmount);
      effectiveUnitPrice = sku.price;
      promotionLabel = '满减活动';
    } else if (String(activity.type) === '5') {
      effectiveUnitPrice = Number(activityProduct.activityPrice);
      if (!Number.isSafeInteger(effectiveUnitPrice) || effectiveUnitPrice < 0 || effectiveUnitPrice > sku.price) {
        throw new BadRequestException('新人活动价无效');
      }
      discountAmount = (sku.price - effectiveUnitPrice) * quantity;
      promotionLabel = '新人优惠';
    }

    return { activity, activityProduct, sku, discountAmount, effectiveUnitPrice, promotionLabel };
  }

  private async assertActivityQuota(
    client: QuotaQueryClient,
    activity: any,
    activityProduct: any,
    skuId: bigint,
    userId: bigint,
    quantity: number,
  ) {
    const [soldRows, userRows] = await Promise.all([
      client.$queryRaw<Array<{ quantity: bigint | number | string }>>`
        SELECT COALESCE(SUM(oi.quantity), 0) AS quantity
        FROM order_items oi
        INNER JOIN orders o ON o.id = oi.order_id
        WHERE oi.activity_id = ${activity.id}
          AND oi.activity_type = 'activity'
          AND oi.sku_id = ${skuId}
          AND o.status <> 'cancelled'
      `,
      client.$queryRaw<Array<{ quantity: bigint | number | string }>>`
        SELECT COALESCE(SUM(oi.quantity), 0) AS quantity
        FROM order_items oi
        INNER JOIN orders o ON o.id = oi.order_id
        WHERE oi.activity_id = ${activity.id}
          AND oi.activity_type = 'activity'
          AND oi.sku_id = ${skuId}
          AND o.user_id = ${userId}
          AND o.status <> 'cancelled'
      `,
    ]);
    const sold = Number(soldRows[0]?.quantity ?? 0);
    const boughtByUser = Number(userRows[0]?.quantity ?? 0);
    const activityStock = Number(activityProduct.activityStock ?? 0);
    const limitPerUser = String(activity.type) === '5'
      ? Math.max(1, Number(activityProduct.limitPerUser || 1))
      : Number(activityProduct.limitPerUser || 0);

    if (!Number.isSafeInteger(sold) || sold < 0 || !Number.isSafeInteger(boughtByUser) || boughtByUser < 0) {
      throw new BadRequestException('活动销量状态异常，请稍后重试');
    }
    if (activityStock <= 0 || sold + quantity > activityStock) {
      throw new BadRequestException('活动库存不足');
    }
    if (limitPerUser > 0 && boughtByUser + quantity > limitPerUser) {
      throw new BadRequestException(`每位用户最多购买${limitPerUser}件活动商品`);
    }
  }

  private resolveFullReduction(rawRules: unknown, amount: number) {
    let rules: any = rawRules;
    if (typeof rules === 'string') {
      try { rules = JSON.parse(rules); } catch { throw new BadRequestException('满减活动规则损坏'); }
    }
    const entries = Array.isArray(rules?.fullReductionRules) ? rules.fullReductionRules : [];
    const normalized = entries.map((rule: any) => ({
      fullAmount: Number(rule.fullAmount),
      reduceAmount: Number(rule.reduceAmount),
    })).filter((rule: any) =>
      Number.isSafeInteger(rule.fullAmount) &&
      Number.isSafeInteger(rule.reduceAmount) &&
      rule.fullAmount > 0 &&
      rule.reduceAmount > 0 &&
      rule.reduceAmount < rule.fullAmount,
    ).sort((a: any, b: any) => b.fullAmount - a.fullAmount);
    if (normalized.length === 0) throw new BadRequestException('满减活动未配置有效规则');
    const matched = normalized.find((rule: any) => amount >= rule.fullAmount);
    return matched ? Math.min(matched.reduceAmount, amount) : 0;
  }

  private assertFulfillment(
    requested: string,
    productFulfillment: string | null | undefined,
    address: any,
    pickupStore: any,
  ) {
    const required = productFulfillment || 'delivery';
    if (required !== requested) {
      throw new BadRequestException(required === 'pickup' ? '该商品仅支持到店自提' : '该商品仅支持快递配送');
    }
    if (requested === 'delivery' && !address) throw new BadRequestException('请选择有效收货地址');
    if (requested === 'pickup' && !pickupStore) throw new BadRequestException('请选择有效自提点');
  }

  private calculateFreight(totalAmount: number, province?: string) {
    const config = this.systemConfigService.getRuntimeConfig();
    const freeShippingAmount = config.freeShippingAmount ?? FREIGHT_FREE_AMOUNT;
    const defaultFreight = config.defaultFreight ?? FREIGHT_DEFAULT_FEE;
    if (totalAmount >= freeShippingAmount) return 0;
    if (province && FREIGHT_REMOTE_AREAS.some((area) => province.includes(area))) return FREIGHT_REMOTE_FEE;
    return defaultFreight;
  }

  private formatSpecs(specs: unknown) {
    if (!specs) return '';
    if (typeof specs === 'string') return specs;
    if (Array.isArray(specs)) return specs.join(' / ');
    if (typeof specs === 'object') return Object.values(specs as Record<string, unknown>).join(' / ');
    return String(specs);
  }
}
