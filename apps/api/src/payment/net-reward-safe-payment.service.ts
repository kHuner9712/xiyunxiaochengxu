import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { BenefitPackageService } from '../benefit-package/benefit-package.service';
import { BusinessEventService } from '../common/business-event.service';
import { REFUND_STATUS } from '../common/constants';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { FlashSaleService } from '../flash-sale/flash-sale.service';
import { GroupBuyService } from '../group-buy/group-buy.service';
import { MerchantSettlementService } from '../merchant-settlement/merchant-settlement.service';
import { OrderService } from '../order/order.service';
import { ShareService } from '../share/share.service';
import { CancellationSafeStockSafePaymentService } from './cancellation-safe-stock-safe-payment.service';

const NET_REWARD_RESTORE_SOURCE = 'refund_reward_net_restore';
const NET_REWARD_DEDUCT_SOURCE = 'refund_reward_net_deduct';
const NET_REWARD_DEDUCT_PARTIAL_SOURCE = 'refund_reward_net_deduct_partial';
const BASE_REWARD_DEDUCT_SOURCES = [
  'aftersale_refund_deduct_reward',
  'aftersale_refund_deduct_reward_partial',
];

@Injectable()
export class NetRewardSafePaymentService extends CancellationSafeStockSafePaymentService {
  constructor(
    private readonly netRewardPrisma: PrismaService,
    configService: ConfigService,
    private readonly netRewardBusinessEvent: BusinessEventService,
    orderService: OrderService,
    shareService: ShareService,
    benefitPackageService: BenefitPackageService,
    merchantSettlementService: MerchantSettlementService,
    groupBuyService: GroupBuyService,
    flashSaleService: FlashSaleService,
    redisService: RedisService,
  ) {
    super(
      netRewardPrisma,
      configService,
      netRewardBusinessEvent,
      orderService,
      shareService,
      benefitPackageService,
      merchantSettlementService,
      groupBuyService,
      flashSaleService,
      redisService,
    );
  }

  override async processWechatRefundSuccess(refund: any, refundId: string, wechatData: any) {
    await super.processWechatRefundSuccess(refund, refundId, wechatData);

    if (!refund?.aftersaleId) return;

    const reconciliation = await this.netRewardPrisma.$transaction(async (tx) => (
      this.reconcileRefundRewardPoints(tx, refund)
    ));

    if (reconciliation?.insufficientPoints) {
      this.netRewardBusinessEvent.emitWarn(
        'refund_reward_net_points_insufficient',
        'refund',
        `退款后净额奖励积分仍需扣回${reconciliation.required}分，实际仅扣回${reconciliation.deducted}分`,
        refund.id.toString(),
        {
          refundId: refund.id.toString(),
          orderId: refund.orderId.toString(),
          requiredDeductedPoints: reconciliation.required,
          actualDeductedPoints: reconciliation.deducted,
          remainingDebtPoints: reconciliation.required - reconciliation.deducted,
        },
      );
    }
  }

  private async reconcileRefundRewardPoints(tx: Prisma.TransactionClient, refund: any) {
    const existingAdjustment = await tx.pointsRecord.findFirst({
      where: {
        sourceId: refund.id,
        source: {
          in: [
            NET_REWARD_RESTORE_SOURCE,
            NET_REWARD_DEDUCT_SOURCE,
            NET_REWARD_DEDUCT_PARTIAL_SOURCE,
          ],
        },
      },
      select: { id: true },
    });
    if (existingAdjustment) return { adjusted: false };

    const order = await tx.order.findUnique({
      where: { id: refund.orderId },
      select: { id: true, userId: true, payAmount: true },
    });
    if (!order || !order.payAmount || order.payAmount <= 0) {
      return { adjusted: false };
    }

    const completionReward = await tx.pointsRecord.findFirst({
      where: {
        userId: order.userId,
        sourceId: order.id,
        source: { in: ['order_complete', 'order_auto_complete'] },
        type: 1,
      },
      select: { points: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!completionReward) {
      return { adjusted: false };
    }

    const successfulRefunds = await tx.orderRefund.aggregate({
      where: {
        orderId: order.id,
        status: REFUND_STATUS.SUCCESS,
      },
      _sum: { refundAmount: true },
    });
    const totalRefundedAfter = Math.min(
      successfulRefunds._sum.refundAmount ?? 0,
      order.payAmount,
    );
    const currentRefundAmount = Math.min(refund.refundAmount ?? 0, totalRefundedAfter);
    const totalRefundedBefore = Math.max(totalRefundedAfter - currentRefundAmount, 0);
    const rewardBefore = Math.floor(Math.max(order.payAmount - totalRefundedBefore, 0) / 100);
    const rewardAfter = Math.floor(Math.max(order.payAmount - totalRefundedAfter, 0) / 100);
    const expectedCurrentDeduction = Math.max(rewardBefore - rewardAfter, 0);

    const actualDeductionRows = await tx.pointsRecord.findMany({
      where: {
        userId: order.userId,
        sourceId: refund.aftersaleId,
        source: { in: BASE_REWARD_DEDUCT_SOURCES },
        type: 2,
      },
      select: { points: true },
    });
    const actualCurrentDeduction = actualDeductionRows.reduce(
      (sum, row) => sum + row.points,
      0,
    );
    const difference = expectedCurrentDeduction - actualCurrentDeduction;
    if (difference === 0) {
      return { adjusted: false };
    }

    const user = await tx.user.findUnique({
      where: { id: order.userId },
      select: { availablePoints: true },
    });
    if (!user) {
      return { adjusted: false };
    }

    if (difference < 0) {
      const restorePoints = Math.abs(difference);
      await tx.user.update({
        where: { id: order.userId },
        data: { availablePoints: { increment: restorePoints } },
      });
      await tx.pointsRecord.create({
        data: {
          userId: order.userId,
          type: 1,
          points: restorePoints,
          balance: user.availablePoints + restorePoints,
          source: NET_REWARD_RESTORE_SOURCE,
          sourceId: refund.id,
          description: `退款奖励积分净额校准，返还${restorePoints}积分`,
        },
      });
      return { adjusted: true, restored: restorePoints };
    }

    const deductPoints = Math.min(user.availablePoints, difference);
    if (deductPoints > 0) {
      await tx.user.update({
        where: { id: order.userId },
        data: { availablePoints: { decrement: deductPoints } },
      });
      await tx.pointsRecord.create({
        data: {
          userId: order.userId,
          type: 2,
          points: deductPoints,
          balance: user.availablePoints - deductPoints,
          source: deductPoints === difference
            ? NET_REWARD_DEDUCT_SOURCE
            : NET_REWARD_DEDUCT_PARTIAL_SOURCE,
          sourceId: refund.id,
          description: deductPoints === difference
            ? `退款奖励积分按净支付额追加扣回${deductPoints}积分`
            : `退款奖励积分按净支付额应追加扣回${difference}积分，余额不足实际扣回${deductPoints}积分`,
        },
      });
    }

    return {
      adjusted: deductPoints > 0,
      required: difference,
      deducted: deductPoints,
      insufficientPoints: deductPoints < difference,
    };
  }
}
