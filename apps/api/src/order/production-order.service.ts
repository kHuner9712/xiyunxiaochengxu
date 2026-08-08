import { BadRequestException, forwardRef, Inject, Injectable, Optional } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import {
  FREIGHT_DEFAULT_FEE,
  FREIGHT_FREE_AMOUNT,
  FREIGHT_REMOTE_AREAS,
  FREIGHT_REMOTE_FEE,
  ORDER_AUTO_CLOSE_MINUTES,
  ORDER_AUTO_COMPLETE_DAYS,
  POINTS_DEDUCT_MAX_PERCENT,
  POINTS_DEDUCT_RATE,
} from '@baby-mall/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { BusinessEventService } from '../common/business-event.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { BenefitPackageService } from '../benefit-package/benefit-package.service';
import { FlashSaleService } from '../flash-sale/flash-sale.service';
import { GroupBuyService } from '../group-buy/group-buy.service';
import { SystemConfigService } from '../system-config/system-config.service';
import { ConfirmOrderDto } from './dto/confirm-order.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { DeliverDto } from './dto/deliver.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import { TransactionalOrderService } from './transactional-order.service';

const ALLOWED_ORDER_SOURCES = new Set([
  'direct',
  'user_referral',
  'merchant_referral',
  'campaign',
]);

@Injectable()
export class ProductionOrderService extends TransactionalOrderService {
  constructor(
    private readonly productionPrisma: PrismaService,
    businessEvent: BusinessEventService,
    benefitPackageService: BenefitPackageService,
    @Inject(forwardRef(() => GroupBuyService))
    groupBuyService: GroupBuyService,
    @Inject(forwardRef(() => FlashSaleService))
    flashSaleService: FlashSaleService,
    @Optional() private readonly systemConfigService?: SystemConfigService,
  ) {
    super(
      productionPrisma,
      businessEvent,
      benefitPackageService,
      groupBuyService,
      flashSaleService,
    );

    const runtime = this as unknown as {
      calculateCouponAmount?: (coupon: any, orderAmount: number) => number;
      calculateFreight?: (totalAmount: number, province?: string) => number;
      calculatePointsDeduction?: (
        baseAmount: number,
        availablePoints: number,
        requestedPoints: number,
      ) => {
        availablePoints: number;
        maxPointsDeduct: number;
        pointsDeducted: number;
        pointsAmount: number;
      };
    };
    if (
      typeof runtime.calculateCouponAmount !== 'function' ||
      typeof runtime.calculateFreight !== 'function' ||
      typeof runtime.calculatePointsDeduction !== 'function'
    ) {
      throw new Error('OrderService production calculators are unavailable');
    }
    runtime.calculateCouponAmount = (coupon: any, orderAmount: number) =>
      this.calculateProductionCouponAmount(coupon, orderAmount);
    runtime.calculateFreight = (totalAmount: number, province?: string) =>
      this.calculateProductionFreight(totalAmount, province);
    runtime.calculatePointsDeduction = (
      baseAmount: number,
      availablePoints: number,
      requestedPoints: number,
    ) => this.calculateProductionPointsDeduction(baseAmount, availablePoints, requestedPoints);
  }

  override async confirm(userId: string, dto: ConfirmOrderDto) {
    const userIdValue = parsePositiveBigIntId(userId, '用户');
    const skuIds = dto.items.map((item) => parsePositiveBigIntId(item.skuId, 'SKU '));
    this.assertOrderQuantities(dto.items.map((item) => item.quantity));
    if (dto.couponId) parsePositiveBigIntId(dto.couponId, '用户优惠券');

    const skuScopes = await this.loadSkuScopes(skuIds);
    if (dto.couponId) {
      await this.assertSelectedCouponApplicable(userIdValue, dto.couponId, skuScopes);
    }

    const result: any = await super.confirm(userId, dto);
    if (Array.isArray(result?.usableCoupons)) {
      result.usableCoupons = result.usableCoupons.filter((candidate: any) =>
        this.couponScopeMatches(candidate?.coupon, skuScopes),
      );
    }
    const config = this.getRuntimeConfig();
    result.pointsDeductRate = config.pointsDeductRate;
    result.pointsDeductMaxPercent = config.pointsDeductMaxPercent;
    return result;
  }

  override async create(userId: string, dto: CreateOrderDto) {
    const userIdValue = parsePositiveBigIntId(userId, '用户');
    const skuIds = dto.items.map((item) => parsePositiveBigIntId(item.skuId, 'SKU '));
    this.assertOrderQuantities(dto.items.map((item) => item.quantity));

    if (dto.couponId) parsePositiveBigIntId(dto.couponId, '用户优惠券');
    if (dto.addressId) parsePositiveBigIntId(dto.addressId, '收货地址');
    if (dto.pickupStoreId) parsePositiveBigIntId(dto.pickupStoreId, '自提点');
    if (dto.shareRecordId) parsePositiveBigIntId(dto.shareRecordId, '分享记录');
    if (dto.shareCampaignId) parsePositiveBigIntId(dto.shareCampaignId, '分享活动');
    if (dto.referrerUserId) parsePositiveBigIntId(dto.referrerUserId, '推荐人用户');
    if (dto.sourceType && !ALLOWED_ORDER_SOURCES.has(dto.sourceType)) {
      throw new BadRequestException('订单来源类型无效');
    }
    if (
      dto.pointsDeduct !== undefined &&
      (!Number.isSafeInteger(dto.pointsDeduct) || dto.pointsDeduct < 0)
    ) {
      throw new BadRequestException('积分抵扣数量无效');
    }

    const skuScopes = await this.loadSkuScopes(skuIds);
    if (dto.couponId) {
      await this.assertSelectedCouponApplicable(userIdValue, dto.couponId, skuScopes);
    }
    const result: any = await super.create(userId, dto);

    // Base OrderService still seeds the legacy default timeout. Persist the configured timeout
    // immediately after creation so the durable order row, scheduler and operator UI all share
    // the same rule. Zero-pay orders have no payment timeout.
    if (!result?.isZeroPay && result?.orderId) {
      const orderId = parsePositiveBigIntId(result.orderId, '订单');
      const created = await this.productionPrisma.order.findUnique({
        where: { id: orderId },
        select: { createdAt: true, status: true },
      });
      if (created?.status === OrderStatus.pending_payment) {
        const autoCloseAt = new Date(
          created.createdAt.getTime() + this.getRuntimeConfig().orderAutoCloseMinutes * 60 * 1000,
        );
        await this.productionPrisma.order.updateMany({
          where: { id: orderId, status: OrderStatus.pending_payment },
          data: { autoCloseAt },
        });
      }
    }
    return result;
  }

  override async adminDeliver(dto: DeliverDto) {
    const result: any = await super.adminDeliver(dto);
    const orderId = parsePositiveBigIntId(dto.orderId, '订单');
    const order = await this.productionPrisma.order.findUnique({
      where: { id: orderId },
      select: { status: true, deliveredAt: true },
    });
    if (order?.status === OrderStatus.delivered && order.deliveredAt) {
      const autoCompleteAt = new Date(
        order.deliveredAt.getTime() + this.getRuntimeConfig().orderAutoCompleteDays * 24 * 60 * 60 * 1000,
      );
      await this.productionPrisma.order.updateMany({
        where: { id: orderId, status: OrderStatus.delivered },
        data: { autoCompleteAt },
      });
    }
    return result;
  }

  override async getOrderCountByUser(userId: string) {
    const userIdValue = parsePositiveBigIntId(userId, '用户');
    const where = { userId: userIdValue };
    const [unpaid, paid, unshipped, pendingPickup, unreceived, aftersale] = await Promise.all([
      this.productionPrisma.order.count({ where: { ...where, status: OrderStatus.pending_payment } }),
      this.productionPrisma.order.count({ where: { ...where, status: OrderStatus.paid } }),
      this.productionPrisma.order.count({ where: { ...where, status: OrderStatus.pending_delivery } }),
      this.productionPrisma.order.count({ where: { ...where, status: OrderStatus.pending_pickup } }),
      this.productionPrisma.order.count({ where: { ...where, status: OrderStatus.delivered } }),
      this.productionPrisma.order.count({ where: { ...where, status: OrderStatus.aftersale } }),
    ]);

    return { unpaid, paid, unshipped, pendingPickup, unreceived, aftersale };
  }

  override async findByUser(userId: string, dto: OrderQueryDto) {
    parsePositiveBigIntId(userId, '用户');
    const result: any = await super.findByUser(userId, dto);
    const list = Array.isArray(result?.list) ? result.list : [];
    return {
      ...result,
      list: await this.attachGroupBuyContext(list),
    };
  }

  override async findById(userId: string, id: string) {
    parsePositiveBigIntId(userId, '用户');
    parsePositiveBigIntId(id, '订单');
    const result: any = await super.findById(userId, id);
    const [view] = await this.attachGroupBuyContext([result]);
    return view;
  }

  override async findByOrderNo(userId: string, orderNo: string) {
    parsePositiveBigIntId(userId, '用户');
    const result: any = await super.findByOrderNo(userId, orderNo);
    const [view] = await this.attachGroupBuyContext([result]);
    return view;
  }

  private getRuntimeConfig() {
    return this.systemConfigService?.getRuntimeConfig() ?? {
      orderAutoCloseMinutes: ORDER_AUTO_CLOSE_MINUTES,
      orderAutoCompleteDays: ORDER_AUTO_COMPLETE_DAYS,
      aftersaleApplyDays: 7,
      defaultFreight: FREIGHT_DEFAULT_FEE,
      freeShippingAmount: FREIGHT_FREE_AMOUNT,
      pointsDeductRate: POINTS_DEDUCT_RATE,
      pointsDeductMaxPercent: POINTS_DEDUCT_MAX_PERCENT,
    };
  }

  private calculateProductionFreight(totalAmount: number, province?: string): number {
    const config = this.getRuntimeConfig();
    if (totalAmount >= config.freeShippingAmount) return 0;
    if (province && FREIGHT_REMOTE_AREAS.some((area) => province.includes(area))) {
      return FREIGHT_REMOTE_FEE;
    }
    return config.defaultFreight;
  }

  private calculateProductionPointsDeduction(
    baseAmount: number,
    availablePoints: number,
    requestedPoints: number,
  ) {
    const config = this.getRuntimeConfig();
    const maxDeductAmount = Math.floor(baseAmount * config.pointsDeductMaxPercent / 100);
    const maxPointsDeduct = Math.floor(maxDeductAmount / 100) * config.pointsDeductRate;
    const normalizedAvailablePoints = Math.max(0, availablePoints || 0);
    const normalizedRequestedPoints = Math.max(0, requestedPoints || 0);

    if (normalizedRequestedPoints > 0) {
      if (normalizedRequestedPoints > normalizedAvailablePoints) {
        throw new BadRequestException('积分不足');
      }
      if (normalizedRequestedPoints % config.pointsDeductRate !== 0) {
        throw new BadRequestException(`积分抵扣需按${config.pointsDeductRate}积分为单位`);
      }
      if (maxPointsDeduct <= 0) {
        throw new BadRequestException('当前订单金额不满足积分抵扣');
      }
      if (normalizedRequestedPoints > maxPointsDeduct) {
        throw new BadRequestException('积分抵扣超过订单可用上限');
      }
    }

    const pointsDeducted = normalizedRequestedPoints;
    const pointsAmount = Math.floor(pointsDeducted / config.pointsDeductRate) * 100;
    return {
      availablePoints: normalizedAvailablePoints,
      maxPointsDeduct,
      pointsDeducted,
      pointsAmount,
    };
  }

  private calculateProductionCouponAmount(coupon: any, orderAmount: number): number {
    if (!coupon || !Number.isSafeInteger(orderAmount) || orderAmount < 0) return 0;
    if (coupon.type === 1 || coupon.type === 3) {
      const fixed = Number(coupon.value || 0);
      if (!Number.isSafeInteger(fixed) || fixed <= 0) return 0;
      return Math.min(fixed, orderAmount);
    }
    if (coupon.type === 2) {
      const discountPercent = Number(coupon.value || 0);
      if (!Number.isFinite(discountPercent) || discountPercent <= 0 || discountPercent > 100) {
        return 0;
      }
      let amount = Math.floor(orderAmount * (1 - discountPercent / 100));
      if (coupon.discountLimit && coupon.discountLimit > 0) {
        amount = Math.min(amount, coupon.discountLimit);
      }
      return Math.max(0, Math.min(amount, orderAmount));
    }
    throw new BadRequestException(`不支持的优惠券类型: ${coupon.type}`);
  }

  private async loadSkuScopes(skuIds: bigint[]) {
    const uniqueIds = Array.from(new Set(skuIds.map((id) => id.toString()))).map((id) => BigInt(id));
    const rows = await this.productionPrisma.productSku.findMany({
      where: { id: { in: uniqueIds } },
      select: {
        id: true,
        productId: true,
        product: { select: { categoryId: true } },
      },
    });
    if (rows.length !== uniqueIds.length) {
      throw new BadRequestException('订单包含不存在的商品规格');
    }
    return rows;
  }

  private async assertSelectedCouponApplicable(
    userId: bigint,
    userCouponId: string,
    skuScopes: Array<{ productId: bigint; product: { categoryId: bigint } }>,
  ) {
    const id = parsePositiveBigIntId(userCouponId, '用户优惠券');
    const now = new Date();
    const userCoupon = await this.productionPrisma.userCoupon.findFirst({
      where: {
        id,
        userId,
        status: 1,
      },
      include: { coupon: true },
    });
    if (!userCoupon) throw new BadRequestException('优惠券不可用或已过期');

    const effectiveExpireAt = userCoupon.expireAt ?? userCoupon.coupon.endTime;
    if (!effectiveExpireAt || effectiveExpireAt.getTime() < now.getTime()) {
      throw new BadRequestException('优惠券不可用或已过期');
    }
    if (!userCoupon.expireAt) {
      await this.productionPrisma.userCoupon.updateMany({
        where: { id: userCoupon.id, userId, status: 1, expireAt: null },
        data: { expireAt: effectiveExpireAt },
      });
    }

    if (!this.couponScopeMatches(userCoupon.coupon, skuScopes)) {
      throw new BadRequestException(
        userCoupon.coupon.applicableType === 1
          ? '该优惠券仅适用于指定商品分类，请将不适用商品分开结算'
          : '该优惠券仅适用于指定商品，请将不适用商品分开结算',
      );
    }
  }

  private couponScopeMatches(
    coupon: any,
    skuScopes: Array<{ productId: bigint; product: { categoryId: bigint } }>,
  ) {
    if (!coupon || coupon.applicableType === 0) return true;
    const ids = new Set(this.parseCouponApplicableIds(coupon.applicableIds));
    if (ids.size === 0) return false;
    if (coupon.applicableType === 1) {
      return skuScopes.every((sku) => ids.has(sku.product.categoryId.toString()));
    }
    if (coupon.applicableType === 2) {
      return skuScopes.every((sku) => ids.has(sku.productId.toString()));
    }
    return false;
  }

  private parseCouponApplicableIds(raw: unknown): string[] {
    if (raw === null || raw === undefined || raw === '') return [];
    let parsed: unknown = raw;
    if (typeof raw === 'string') {
      try {
        parsed = JSON.parse(raw);
      } catch {
        return [];
      }
    }
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      parsed = (parsed as Record<string, unknown>).ids ?? [];
    }
    if (!Array.isArray(parsed)) return [];
    const result: string[] = [];
    for (const item of parsed) {
      try {
        result.push(parsePositiveBigIntId(item, '优惠券适用范围').toString());
      } catch {
        return [];
      }
    }
    return result;
  }

  private assertOrderQuantities(quantities: number[]) {
    if (
      quantities.some(
        (quantity) => !Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 99,
      )
    ) {
      throw new BadRequestException('商品数量必须为1-99的整数');
    }
  }

  private async attachGroupBuyContext<T extends { id?: string | number | bigint }>(
    views: T[],
  ): Promise<Array<T & { groupBuyGroupId?: string }>> {
    const orderIds = views
      .map((view) => view?.id)
      .filter((id): id is string | number | bigint => id !== undefined && id !== null && id !== '')
      .map((id) => parsePositiveBigIntId(id, '订单'));
    if (orderIds.length === 0) return views;

    const members = await this.productionPrisma.groupBuyMember.findMany({
      where: {
        orderId: { in: orderIds },
        deletedAt: null,
      },
      select: { orderId: true, groupId: true },
    });
    const groupByOrder = new Map(
      members.map((member) => [member.orderId.toString(), member.groupId.toString()]),
    );

    return views.map((view) => {
      const id = view.id?.toString();
      const groupBuyGroupId = id ? groupByOrder.get(id) : undefined;
      return groupBuyGroupId ? { ...view, groupBuyGroupId } : view;
    });
  }
}
