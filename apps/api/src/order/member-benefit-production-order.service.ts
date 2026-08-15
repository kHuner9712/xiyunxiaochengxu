import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable, Optional } from '@nestjs/common';
import { REFUND_STATUS } from '../common/constants';
import { PrismaService } from '../common/prisma/prisma.service';
import { BusinessEventService } from '../common/business-event.service';
import { RedisService } from '../common/redis/redis.service';
import { BenefitPackageService } from '../benefit-package/benefit-package.service';
import { FlashSaleService } from '../flash-sale/flash-sale.service';
import { GroupBuyService } from '../group-buy/group-buy.service';
import {
  calculateMemberDiscountAmount,
  calculateMemberRewardPoints,
  calculateOrderGrowthValue,
  loadActiveMemberLevels,
  reconcileMemberLevelForGrowth,
  resolveMemberLevel,
} from '../member/member-level-runtime';
import { SystemConfigService } from '../system-config/system-config.service';
import { CancellationSafeProductionOrderService } from './cancellation-safe-production-order.service';
import { ConfirmOrderDto } from './dto/confirm-order.dto';
import { CreateOrderDto } from './dto/create-order.dto';

interface MemberPricingContext {
  userId: bigint;
  discountRate: number | null;
  couponAmount: number;
}

/**
 * Outermost production OrderService provider for normal (non-promotion) orders.
 *
 * The legacy core checkout already owns inventory, coupon, points, payment and cancellation
 * invariants. Rather than duplicating that state machine, this wrapper injects the current member
 * price into the private pricing calculators and into the transaction's order.create call.
 * AsyncLocalStorage keeps the pricing context request-local even though Nest services are singletons.
 *
 * Promotion orders do not enter this context; flash-sale/group-buy/activity checkout remains solely
 * governed by PromotionCheckoutService and therefore cannot accidentally double-stack member price.
 */
@Injectable()
export class MemberBenefitProductionOrderService extends CancellationSafeProductionOrderService {
  private readonly memberPricing = new AsyncLocalStorage<MemberPricingContext>();

  constructor(
    private readonly memberPrisma: PrismaService,
    businessEventService: BusinessEventService,
    benefitPackageService: BenefitPackageService,
    groupBuyService: GroupBuyService,
    flashSaleService: FlashSaleService,
    redisService: RedisService,
    @Optional() systemConfigService?: SystemConfigService,
  ) {
    super(
      memberPrisma,
      businessEventService,
      benefitPackageService,
      groupBuyService,
      flashSaleService,
      redisService,
      systemConfigService,
    );
    this.installMemberPricingHooks();

    // CancellationSafeProductionOrderService wraps the legacy reward method to use net paid amount
    // after any successful pre-completion refund. Replace only that private reward capability with a
    // member-aware implementation that preserves the same net-pay invariant and its serialized ledger
    // semantics.
    (this as any).rewardCompletedOrder = (
      tx: any,
      order: any,
      rewardSource: string,
    ) => this.rewardCompletedOrderWithMemberBenefits(tx, order, rewardSource);
  }

  override async confirm(userId: string, dto: ConfirmOrderDto) {
    const context = await this.resolvePricingContext(userId);
    return this.memberPricing.run(context, async () => {
      const result: any = await super.confirm(userId, dto);
      return {
        ...result,
        discountAmount: calculateMemberDiscountAmount(
          Number(result?.totalAmount || 0),
          context.discountRate,
        ),
      };
    });
  }

  override async create(userId: string, dto: CreateOrderDto) {
    const context = await this.resolvePricingContext(userId);
    return this.memberPricing.run(context, () => super.create(userId, dto));
  }

  private async resolvePricingContext(userId: string): Promise<MemberPricingContext> {
    const userIdValue = BigInt(userId);
    const user = await this.memberPrisma.user.findFirst({
      where: { id: userIdValue, deletedAt: null },
      select: { growthValue: true },
    });
    const levels = user ? await loadActiveMemberLevels(this.memberPrisma) : [];
    const level = user ? resolveMemberLevel(levels, user.growthValue) : null;
    return {
      userId: userIdValue,
      discountRate: level?.discountRate ?? null,
      couponAmount: 0,
    };
  }

  private installMemberPricingHooks() {
    const runtime = this as any;
    const originalCalculatePayAmount = runtime.calculatePayAmount?.bind(this);
    const originalCalculateCouponAmount = runtime.calculateCouponAmount?.bind(this);
    const originalCalculatePointsDeduction = runtime.calculatePointsDeduction?.bind(this);
    if (
      typeof originalCalculatePayAmount !== 'function' ||
      typeof originalCalculateCouponAmount !== 'function' ||
      typeof originalCalculatePointsDeduction !== 'function'
    ) {
      throw new Error('OrderService member pricing hooks are unavailable');
    }

    runtime.calculateCouponAmount = (coupon: any, orderAmount: number) => {
      const couponAmount = originalCalculateCouponAmount(coupon, orderAmount);
      const context = this.memberPricing.getStore();
      if (context) context.couponAmount = Math.max(0, Number(couponAmount || 0));
      return couponAmount;
    };

    runtime.calculatePayAmount = (amounts: any) => {
      const context = this.memberPricing.getStore();
      if (!context) return originalCalculatePayAmount(amounts);
      const memberDiscount = calculateMemberDiscountAmount(
        Number(amounts.totalAmount || 0),
        context.discountRate,
      );
      return originalCalculatePayAmount({
        ...amounts,
        discountAmount: Number(amounts.discountAmount || 0) + memberDiscount,
      });
    };

    runtime.calculatePointsDeduction = (
      baseAmount: number,
      availablePoints: number,
      requestedPoints: number,
    ) => {
      const context = this.memberPricing.getStore();
      const memberDiscount = context
        ? calculateMemberDiscountAmount(baseAmount, context.discountRate)
        : 0;
      const couponAmount = context?.couponAmount ?? 0;
      return originalCalculatePointsDeduction(
        Math.max(0, baseAmount - memberDiscount - couponAmount),
        availablePoints,
        requestedPoints,
      );
    };

    const originalTransaction = this.memberPrisma.$transaction.bind(this.memberPrisma) as any;
    (this.memberPrisma as any).$transaction = ((input: any, ...rest: any[]) => {
      const context = this.memberPricing.getStore();
      if (!context || typeof input !== 'function') {
        return originalTransaction(input, ...rest);
      }

      return originalTransaction(async (tx: any) => {
        const orderDelegate = tx.order;
        const orderProxy = new Proxy(orderDelegate, {
          get(target, property) {
            if (property === 'create') {
              return async (args: any) => {
                const data = args?.data;
                const sameUser = data?.userId?.toString?.() === context.userId.toString();
                if (!sameUser) return target.create(args);
                const memberDiscount = calculateMemberDiscountAmount(
                  Number(data.totalAmount || 0),
                  context.discountRate,
                );
                return target.create({
                  ...args,
                  data: {
                    ...data,
                    discountAmount: memberDiscount,
                  },
                });
              };
            }
            const value = Reflect.get(target, property, target);
            return typeof value === 'function' ? value.bind(target) : value;
          },
        });
        const txProxy = new Proxy(tx, {
          get(target, property) {
            if (property === 'order') return orderProxy;
            const value = Reflect.get(target, property, target);
            return typeof value === 'function' ? value.bind(target) : value;
          },
        });
        return input(txProxy);
      }, ...rest);
    }) as any;
  }

  private async rewardCompletedOrderWithMemberBenefits(
    tx: any,
    order: any,
    rewardSource: string,
  ): Promise<number> {
    const refundSummary = await tx.orderRefund.aggregate({
      where: { orderId: order.id, status: REFUND_STATUS.SUCCESS },
      _sum: { refundAmount: true },
    });
    const successfulRefundAmount = refundSummary?._sum?.refundAmount ?? 0;
    const netPayAmount = Math.max((order.payAmount ?? 0) - successfulRefundAmount, 0);

    const existingRecord = await tx.pointsRecord.findFirst({
      where: { source: rewardSource, sourceId: order.id },
    });
    if (existingRecord) return 0;

    // Completing different orders for the same member can happen concurrently (manual receipt and
    // scheduler completion included). Serialize the entire reward-rate/growth-level calculation on
    // the user row so the second completion observes the first completion's growth and member level.
    // An atomic increment alone would preserve the final totals but could still produce a stale
    // points-rate decision, a duplicated ledger balance, and a missed level upgrade.
    await tx.$queryRaw`
      SELECT id
      FROM users
      WHERE id = ${order.userId}
        AND deleted_at IS NULL
      FOR UPDATE
    `;

    const user = await tx.user.findFirst({
      where: { id: order.userId, deletedAt: null },
      select: {
        availablePoints: true,
        growthValue: true,
        memberLevelId: true,
      },
    });
    if (!user) return 0;

    const levels = await loadActiveMemberLevels(tx);
    const currentLevel = resolveMemberLevel(levels, user.growthValue);
    const earnedPoints = calculateMemberRewardPoints(netPayAmount, currentLevel?.pointsRate);
    const earnedGrowthValue = calculateOrderGrowthValue(netPayAmount);
    if (earnedPoints <= 0 && earnedGrowthValue <= 0) return 0;

    const updatedUser = await tx.user.update({
      where: { id: order.userId },
      data: {
        availablePoints: { increment: earnedPoints },
        totalPoints: { increment: earnedPoints },
        growthValue: { increment: earnedGrowthValue },
      },
      select: {
        availablePoints: true,
        growthValue: true,
        memberLevelId: true,
      },
    });
    await reconcileMemberLevelForGrowth(tx, {
      userId: order.userId,
      currentMemberLevelId: updatedUser.memberLevelId,
      growthValue: updatedUser.growthValue,
      reason: `订单${order.orderNo || order.id.toString()}完成，成长值更新为${updatedUser.growthValue}`,
      levels,
    });
    if (earnedPoints > 0) {
      await tx.pointsRecord.create({
        data: {
          userId: order.userId,
          type: 1,
          points: earnedPoints,
          balance: updatedUser.availablePoints,
          source: rewardSource,
          sourceId: order.id,
          description: `完成订单奖励${earnedPoints}积分`,
        },
      });
    }
    return earnedPoints;
  }
}
