import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BenefitPackageService } from '../benefit-package/benefit-package.service';
import { BusinessEventService } from '../common/business-event.service';
import { REFUND_STATUS } from '../common/constants';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { FlashSaleService } from '../flash-sale/flash-sale.service';
import { GroupBuyService } from '../group-buy/group-buy.service';
import {
  loadActiveMemberLevels,
  reconcileMemberLevelForGrowth,
} from '../member/member-level-runtime';
import { MerchantSettlementService } from '../merchant-settlement/merchant-settlement.service';
import { OrderService } from '../order/order.service';
import { ShareService } from '../share/share.service';
import { PromotionRecoveringDurableZeroPayAftersalePaymentService } from './promotion-recovering-durable-zero-pay-aftersale-payment.service';
import { calculateRefundPointTargets } from './refund-points-conservation';

const REFUND_GROWTH_CONSERVATION_REASON = 'refund_growth_conservation';
const COMPLETION_REWARD_SOURCES = ['order_complete', 'order_auto_complete'];

@Injectable()
export class MemberGrowthConservingPaymentService extends PromotionRecoveringDurableZeroPayAftersalePaymentService {
  private readonly memberGrowthLogger = new Logger(MemberGrowthConservingPaymentService.name);

  constructor(
    private readonly memberGrowthPrisma: PrismaService,
    configService: ConfigService,
    businessEvent: BusinessEventService,
    orderService: OrderService,
    shareService: ShareService,
    benefitPackageService: BenefitPackageService,
    merchantSettlementService: MerchantSettlementService,
    @Inject(GroupBuyService) groupBuyService: GroupBuyService,
    flashSaleService: FlashSaleService,
    redisService: RedisService,
  ) {
    super(
      memberGrowthPrisma,
      configService,
      businessEvent,
      orderService,
      shareService,
      benefitPackageService as any,
      merchantSettlementService,
      groupBuyService as any,
      flashSaleService,
      redisService,
    );
  }

  override async processWechatRefundSuccess(refund: any, refundId: string, wechatData: any) {
    try {
      await super.processWechatRefundSuccess(refund, refundId, wechatData);
    } catch (error) {
      await this.bestEffortReconcileSuccessfulRefundGrowth(refund?.id);
      throw error;
    }
    await this.bestEffortReconcileSuccessfulRefundGrowth(refund?.id);
  }

  override async reconcileRefundSuccessSideEffects(limit = 200) {
    const inherited = await super.reconcileRefundSuccessSideEffects(limit);
    const memberGrowthConservation = await this.reconcileRefundGrowthConservation(limit);
    return { ...inherited, memberGrowthConservation };
  }

  override async resolveCompensationTask(
    id: string,
    handledBy: string,
    resolution: string,
    status: 'resolved' | 'ignored',
  ) {
    const taskId = parsePositiveBigIntId(id, '补偿任务');
    const task = await this.memberGrowthPrisma.paymentCompensationTask.findFirst({
      where: { id: taskId },
      select: { reason: true },
    });
    if (task?.reason === REFUND_GROWTH_CONSERVATION_REASON) {
      throw new BadRequestException('退款成长值守恒补偿任务不能人工关闭，必须由自动对账实际收敛后关闭');
    }
    return super.resolveCompensationTask(id, handledBy, resolution, status);
  }

  async reconcileRefundGrowthConservation(limit = 200) {
    const safeLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 1000) : 200;
    const candidates = await this.memberGrowthPrisma.$queryRaw<Array<{
      orderId: bigint;
      orderNo: string;
    }>>`
      SELECT o.id AS orderId, o.order_no AS orderNo
      FROM orders o
      INNER JOIN (
        SELECT order_id, MAX(updated_at) AS latest_refund_at
        FROM order_refunds
        WHERE status = ${REFUND_STATUS.SUCCESS}
        GROUP BY order_id
      ) refunds ON refunds.order_id = o.id
      LEFT JOIN payment_compensation_tasks task
        ON task.order_no = o.order_no
       AND task.reason = ${REFUND_GROWTH_CONSERVATION_REASON}
       AND task.transaction_id = CONCAT('refund-growth:', o.id)
      WHERE task.id IS NULL
         OR task.handled_at IS NULL
         OR refunds.latest_refund_at > task.handled_at
      ORDER BY refunds.latest_refund_at ASC, o.id ASC
      LIMIT ${safeLimit}
    `;

    for (const candidate of candidates) {
      await this.ensureGrowthTask(candidate.orderId, candidate.orderNo);
    }

    const tasks = await this.memberGrowthPrisma.paymentCompensationTask.findMany({
      where: { reason: REFUND_GROWTH_CONSERVATION_REASON, status: 'pending' },
      orderBy: { updatedAt: 'asc' },
      take: safeLimit,
    });

    let resolved = 0;
    let debtPending = 0;
    let failed = 0;
    for (const task of tasks) {
      const order = await this.memberGrowthPrisma.order.findFirst({
        where: { orderNo: task.orderNo },
        select: { id: true },
      });
      if (!order) {
        failed += 1;
        await this.memberGrowthPrisma.paymentCompensationTask.update({
          where: { id: task.id },
          data: { resolution: '成长值守恒补偿失败：对应订单不存在' },
        });
        continue;
      }

      try {
        const result = await this.reconcileOrderRefundGrowth(order.id);
        if (result.outstandingGrowthClawback > 0) debtPending += 1;
        else resolved += 1;
      } catch (error) {
        failed += 1;
        await this.memberGrowthPrisma.paymentCompensationTask.updateMany({
          where: { id: task.id, status: 'pending' },
          data: {
            resolution: `成长值守恒自动对账失败，等待重试：${(error as Error).message}`.slice(0, 4000),
          },
        });
        this.memberGrowthLogger.error(
          `退款成长值守恒对账失败: orderId=${order.id}, error=${(error as Error).message}`,
        );
      }
    }

    return { seeded: candidates.length, total: tasks.length, resolved, debtPending, failed };
  }

  private async bestEffortReconcileSuccessfulRefundGrowth(refundRecordId: bigint | undefined) {
    if (!refundRecordId) return;
    try {
      const current = await this.memberGrowthPrisma.orderRefund.findUnique({
        where: { id: refundRecordId },
        select: { orderId: true, status: true },
      });
      if (current?.status !== REFUND_STATUS.SUCCESS) return;
      await this.reconcileOrderRefundGrowth(current.orderId);
    } catch (error) {
      this.memberGrowthLogger.error(
        `退款核心已成功但成长值守恒即时对账失败，将由定时任务补偿: refundId=${refundRecordId}, error=${(error as Error).message}`,
      );
    }
  }

  private async ensureGrowthTask(orderId: bigint, orderNo: string) {
    const transactionId = `refund-growth:${orderId}`;
    const existing = await this.memberGrowthPrisma.paymentCompensationTask.findFirst({
      where: {
        orderNo,
        reason: REFUND_GROWTH_CONSERVATION_REASON,
        transactionId,
      },
    });
    if (existing) {
      await this.memberGrowthPrisma.paymentCompensationTask.update({
        where: { id: existing.id },
        data: {
          status: 'pending',
          handledBy: null,
          handledAt: null,
          resolution: '检测到新的成功退款或未完成成长值守恒，等待自动对账',
        },
      });
      return existing;
    }
    try {
      return await this.memberGrowthPrisma.paymentCompensationTask.create({
        data: {
          orderNo,
          transactionId,
          amount: null,
          reason: REFUND_GROWTH_CONSERVATION_REASON,
          status: 'pending',
          callbackPayload: {
            orderId: orderId.toString(),
            clawedGrowthValue: 0,
          },
        },
      });
    } catch (error: any) {
      if (error?.code !== 'P2002') throw error;
      return this.memberGrowthPrisma.paymentCompensationTask.findFirst({
        where: { orderNo, reason: REFUND_GROWTH_CONSERVATION_REASON, transactionId },
      });
    }
  }

  private async reconcileOrderRefundGrowth(orderId: bigint) {
    return this.memberGrowthPrisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`;
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          orderNo: true,
          userId: true,
          payAmount: true,
        },
      });
      if (!order) throw new Error('退款成长值对账对应订单不存在');

      const transactionId = `refund-growth:${order.id}`;
      let task = await tx.paymentCompensationTask.findFirst({
        where: {
          orderNo: order.orderNo,
          reason: REFUND_GROWTH_CONSERVATION_REASON,
          transactionId,
        },
      });
      if (!task) {
        task = await tx.paymentCompensationTask.create({
          data: {
            orderNo: order.orderNo,
            transactionId,
            amount: null,
            reason: REFUND_GROWTH_CONSERVATION_REASON,
            status: 'pending',
            callbackPayload: { orderId: order.id.toString(), clawedGrowthValue: 0 },
          },
        });
      }

      const successfulRefunds = await tx.orderRefund.findMany({
        where: { orderId: order.id, status: REFUND_STATUS.SUCCESS },
        select: { refundAmount: true },
        orderBy: { id: 'asc' },
      });
      const rewardAggregate = await tx.pointsRecord.aggregate({
        where: {
          userId: order.userId,
          type: 1,
          source: { in: COMPLETION_REWARD_SOURCES },
          sourceId: order.id,
        },
        _sum: { points: true },
      });
      const originalRewardPoints = Math.max(0, rewardAggregate._sum.points ?? 0);
      const cumulativeRefundAmount = successfulRefunds.reduce(
        (sum, refund) => sum + Math.max(0, refund.refundAmount),
        0,
      );
      const target = calculateRefundPointTargets({
        payAmount: Math.max(0, order.payAmount || 0),
        cumulativeRefundAmount,
        originalDeductedPoints: 0,
        originalRewardPoints,
      }).clawbackRewardTarget;

      await tx.$queryRaw`SELECT id FROM users WHERE id = ${order.userId} FOR UPDATE`;
      const user = await tx.user.findFirst({
        where: { id: order.userId, deletedAt: null },
        select: { growthValue: true, memberLevelId: true },
      });
      if (!user) throw new Error('退款成长值对账用户不存在');

      const payload = task.callbackPayload && typeof task.callbackPayload === 'object'
        ? task.callbackPayload as Record<string, unknown>
        : {};
      const previouslyClawed = Math.max(0, Number(payload.clawedGrowthValue || 0));
      const due = Math.max(0, target - previouslyClawed);
      const clawedDelta = Math.min(user.growthValue, due);
      const nextGrowthValue = Math.max(0, user.growthValue - clawedDelta);
      if (clawedDelta > 0) {
        await tx.user.update({
          where: { id: order.userId },
          data: { growthValue: { decrement: clawedDelta } },
        });
        const levels = await loadActiveMemberLevels(tx);
        await reconcileMemberLevelForGrowth(tx, {
          userId: order.userId,
          currentMemberLevelId: user.memberLevelId,
          growthValue: nextGrowthValue,
          reason: `订单${order.orderNo}累计退款，成长值回退至${nextGrowthValue}`,
          levels,
        });
      }

      const clawedGrowthValue = previouslyClawed + clawedDelta;
      const outstandingGrowthClawback = Math.max(0, target - clawedGrowthValue);
      const nextPayload = {
        ...payload,
        orderId: order.id.toString(),
        cumulativeRefundAmount,
        growthClawbackTarget: target,
        clawedGrowthValue,
        outstandingGrowthClawback,
      };

      if (outstandingGrowthClawback > 0) {
        await tx.paymentCompensationTask.update({
          where: { id: task.id },
          data: {
            status: 'pending',
            handledBy: null,
            handledAt: null,
            callbackPayload: nextPayload,
            resolution: `成长值仍有${outstandingGrowthClawback}待回退；当前成长值不足时持续自动重试`,
          },
        });
      } else {
        await tx.paymentCompensationTask.update({
          where: { id: task.id },
          data: {
            status: 'resolved',
            handledBy: 'system',
            handledAt: new Date(),
            callbackPayload: nextPayload,
            resolution: '累计成功退款金额与订单完成成长值回退已严格守恒',
          },
        });
      }

      return { clawedDelta, outstandingGrowthClawback };
    });
  }
}
