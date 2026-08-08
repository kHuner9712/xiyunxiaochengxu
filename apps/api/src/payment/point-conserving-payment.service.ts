import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BenefitPackageService } from '../benefit-package/benefit-package.service';
import { BusinessEventService } from '../common/business-event.service';
import { REFUND_STATUS } from '../common/constants';
import { PrismaService } from '../common/prisma/prisma.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { FlashSaleService } from '../flash-sale/flash-sale.service';
import { GroupBuyService } from '../group-buy/group-buy.service';
import { MerchantSettlementService } from '../merchant-settlement/merchant-settlement.service';
import { OrderService } from '../order/order.service';
import { ShareService } from '../share/share.service';
import { RedisService } from '../common/redis/redis.service';
import { CancellationSafeStockSafePaymentService } from './cancellation-safe-stock-safe-payment.service';
import { calculateRefundPointTargets } from './refund-points-conservation';

const REFUND_POINTS_CONSERVATION_REASON = 'refund_points_conservation';
const RESTORE_RECONCILE_SOURCE = 'refund_restore_reconcile';
const CLAWBACK_RECONCILE_SOURCE = 'refund_reward_reconcile';
const ORIGINAL_COMPLETION_REWARD_SOURCES = ['order_complete', 'order_auto_complete'];
const LEGACY_RESTORE_SOURCES = ['aftersale_refund_restore_deducted'];
const LEGACY_CLAWBACK_SOURCES = [
  'aftersale_refund_deduct_reward',
  'aftersale_refund_deduct_reward_partial',
];

@Injectable()
export class PointConservingPaymentService extends CancellationSafeStockSafePaymentService {
  private readonly conservationLogger = new Logger(PointConservingPaymentService.name);

  constructor(
    private readonly conservationPrisma: PrismaService,
    configService: ConfigService,
    businessEvent: BusinessEventService,
    orderService: OrderService,
    shareService: ShareService,
    benefitPackageService: BenefitPackageService,
    merchantSettlementService: MerchantSettlementService,
    groupBuyService: GroupBuyService,
    flashSaleService: FlashSaleService,
    redisService: RedisService,
  ) {
    super(
      conservationPrisma,
      configService,
      businessEvent,
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
    try {
      await super.processWechatRefundSuccess(refund, refundId, wechatData);
    } catch (error) {
      await this.bestEffortReconcileSuccessfulRefundPoints(refund.id);
      throw error;
    }
    await this.bestEffortReconcileSuccessfulRefundPoints(refund.id);
  }

  override async reconcileRefundSuccessSideEffects(limit = 200) {
    const sideEffects = await super.reconcileRefundSuccessSideEffects(limit);
    const pointConservation = await this.reconcileRefundPointConservation(limit);
    return { ...sideEffects, pointConservation };
  }

  /**
   * Reconciles successful-refund point effects against cumulative order-level targets.
   * A task is kept pending while completion-reward points cannot yet be fully clawed back because
   * the user already spent them. The task is automatically retried by the refund scheduler.
   */
  async reconcileRefundPointConservation(limit = 200) {
    const candidates = await this.conservationPrisma.$queryRaw<Array<{
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
       AND task.reason = ${REFUND_POINTS_CONSERVATION_REASON}
       AND task.transaction_id = CONCAT('refund-points:', o.id)
      WHERE task.id IS NULL
         OR task.handled_at IS NULL
         OR refunds.latest_refund_at > task.handled_at
      ORDER BY refunds.latest_refund_at ASC, o.id ASC
      LIMIT ${limit}
    `;

    let seeded = 0;
    for (const candidate of candidates) {
      const transactionId = `refund-points:${candidate.orderId}`;
      const existing = await this.conservationPrisma.paymentCompensationTask.findFirst({
        where: {
          orderNo: candidate.orderNo,
          reason: REFUND_POINTS_CONSERVATION_REASON,
          transactionId,
        },
      });
      if (existing) {
        await this.conservationPrisma.paymentCompensationTask.update({
          where: { id: existing.id },
          data: {
            status: 'pending',
            handledBy: null,
            handledAt: null,
            resolution: '检测到新的成功退款或未完成积分守恒，等待自动对账',
          },
        });
      } else {
        try {
          await this.conservationPrisma.paymentCompensationTask.create({
            data: {
              orderNo: candidate.orderNo,
              transactionId,
              amount: null,
              reason: REFUND_POINTS_CONSERVATION_REASON,
              status: 'pending',
              callbackPayload: { orderId: candidate.orderId.toString() },
            },
          });
        } catch (error: any) {
          if (error?.code !== 'P2002') throw error;
        }
      }
      seeded += 1;
    }

    const tasks = await this.conservationPrisma.paymentCompensationTask.findMany({
      where: { reason: REFUND_POINTS_CONSERVATION_REASON, status: 'pending' },
      orderBy: { updatedAt: 'asc' },
      take: limit,
    });

    let resolved = 0;
    let debtPending = 0;
    let failed = 0;
    for (const task of tasks) {
      const order = await this.conservationPrisma.order.findFirst({
        where: { orderNo: task.orderNo },
        select: { id: true },
      });
      if (!order) {
        failed += 1;
        await this.conservationPrisma.paymentCompensationTask.update({
          where: { id: task.id },
          data: { resolution: '积分守恒补偿失败：对应订单不存在' },
        });
        continue;
      }

      try {
        const result = await this.reconcileOrderRefundPoints(order.id);
        if (result.outstandingRewardClawback > 0) debtPending += 1;
        else resolved += 1;
      } catch (error) {
        failed += 1;
        await this.conservationPrisma.paymentCompensationTask.updateMany({
          where: { id: task.id, status: 'pending' },
          data: {
            resolution: `积分守恒自动对账失败，等待重试：${(error as Error).message}`.slice(0, 4000),
          },
        });
        this.conservationLogger.error(
          `退款积分守恒对账失败: orderId=${order.id}, error=${(error as Error).message}`,
        );
      }
    }

    return { seeded, total: tasks.length, resolved, debtPending, failed };
  }

  override async resolveCompensationTask(
    id: string,
    handledBy: string,
    resolution: string,
    status: 'resolved' | 'ignored',
  ) {
    const taskId = parsePositiveBigIntId(id, '补偿任务');
    const task = await this.conservationPrisma.paymentCompensationTask.findFirst({
      where: { id: taskId },
      select: { reason: true },
    });
    if (task?.reason === REFUND_POINTS_CONSERVATION_REASON) {
      throw new BadRequestException('退款积分守恒补偿任务不能人工关闭，必须由自动对账实际收敛后关闭');
    }
    return super.resolveCompensationTask(id, handledBy, resolution, status);
  }

  private async bestEffortReconcileSuccessfulRefundPoints(refundRecordId: bigint) {
    try {
      const current = await this.conservationPrisma.orderRefund.findUnique({
        where: { id: refundRecordId },
        select: { orderId: true, status: true },
      });
      if (current?.status !== REFUND_STATUS.SUCCESS) return;
      await this.reconcileOrderRefundPoints(current.orderId);
    } catch (error) {
      this.conservationLogger.error(
        `退款核心已成功但积分守恒即时对账失败，将由定时任务补偿: refundId=${refundRecordId}, error=${(error as Error).message}`,
      );
    }
  }

  private async reconcileOrderRefundPoints(orderId: bigint) {
    return this.conservationPrisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`;
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          orderNo: true,
          userId: true,
          payAmount: true,
          pointsDeducted: true,
        },
      });
      if (!order) throw new Error('退款积分对账对应订单不存在');

      const transactionId = `refund-points:${order.id}`;
      const successfulRefunds = await tx.orderRefund.findMany({
        where: { orderId: order.id, status: REFUND_STATUS.SUCCESS },
        select: { id: true, refundAmount: true },
        orderBy: { id: 'asc' },
      });
      if (successfulRefunds.length === 0 || !order.payAmount || order.payAmount <= 0) {
        await this.finishConservationTask(tx, order.orderNo, transactionId, {
          orderId: order.id.toString(),
          cumulativeRefundAmount: 0,
          restoreDeductedTarget: 0,
          restoredPoints: 0,
          clawbackRewardTarget: 0,
          clawedRewardPoints: 0,
          outstandingRewardClawback: 0,
        });
        return { restoredDelta: 0, clawedDelta: 0, outstandingRewardClawback: 0 };
      }

      await tx.$queryRaw`SELECT id FROM users WHERE id = ${order.userId} FOR UPDATE`;
      const user = await tx.user.findFirst({
        where: { id: order.userId, deletedAt: null },
        select: { availablePoints: true },
      });
      if (!user) throw new Error('退款积分对账用户不存在');

      const cumulativeRefundAmount = successfulRefunds.reduce(
        (sum, current) => sum + Math.max(0, current.refundAmount),
        0,
      );
      const latestRefund = successfulRefunds[successfulRefunds.length - 1];
      const refundIds = successfulRefunds.map((item) => item.id);
      const aftersales = await tx.aftersaleOrder.findMany({
        where: { orderId: order.id },
        select: { id: true },
      });
      const aftersaleIds = aftersales.map((item) => item.id);

      const completionReward = await tx.pointsRecord.aggregate({
        where: {
          userId: order.userId,
          type: 1,
          sourceId: order.id,
          source: { in: ORIGINAL_COMPLETION_REWARD_SOURCES },
        },
        _sum: { points: true },
      });
      const originalRewardPoints = Math.max(0, completionReward._sum.points ?? 0);

      const [legacyRestored, reconciledRestored, legacyClawed, reconciledClawed] = await Promise.all([
        aftersaleIds.length > 0
          ? tx.pointsRecord.aggregate({
              where: {
                userId: order.userId,
                type: 1,
                source: { in: LEGACY_RESTORE_SOURCES },
                sourceId: { in: aftersaleIds },
              },
              _sum: { points: true },
            })
          : Promise.resolve({ _sum: { points: null } }),
        tx.pointsRecord.aggregate({
          where: {
            userId: order.userId,
            type: 1,
            source: RESTORE_RECONCILE_SOURCE,
            sourceId: { in: refundIds },
          },
          _sum: { points: true },
        }),
        aftersaleIds.length > 0
          ? tx.pointsRecord.aggregate({
              where: {
                userId: order.userId,
                type: 2,
                source: { in: LEGACY_CLAWBACK_SOURCES },
                sourceId: { in: aftersaleIds },
              },
              _sum: { points: true },
            })
          : Promise.resolve({ _sum: { points: null } }),
        tx.pointsRecord.aggregate({
          where: {
            userId: order.userId,
            type: 2,
            source: CLAWBACK_RECONCILE_SOURCE,
            sourceId: { in: refundIds },
          },
          _sum: { points: true },
        }),
      ]);

      let restoredPoints = Math.max(
        0,
        (legacyRestored._sum.points ?? 0) + (reconciledRestored._sum.points ?? 0),
      );
      let clawedRewardPoints = Math.max(
        0,
        (legacyClawed._sum.points ?? 0) + (reconciledClawed._sum.points ?? 0),
      );

      const targets = calculateRefundPointTargets({
        payAmount: order.payAmount,
        cumulativeRefundAmount,
        originalDeductedPoints: Math.max(0, order.pointsDeducted),
        originalRewardPoints,
      });

      const restoreDelta = Math.max(0, targets.restoreDeductedTarget - restoredPoints);
      let availablePoints = user.availablePoints;
      if (restoreDelta > 0) {
        await tx.user.update({
          where: { id: order.userId },
          data: { availablePoints: { increment: restoreDelta } },
        });
        availablePoints += restoreDelta;
        restoredPoints += restoreDelta;
        await tx.pointsRecord.create({
          data: {
            userId: order.userId,
            type: 1,
            points: restoreDelta,
            balance: availablePoints,
            source: RESTORE_RECONCILE_SOURCE,
            sourceId: latestRefund.id,
            description: `累计退款积分守恒补差，归还抵扣积分${restoreDelta}`,
          },
        });
      }

      const clawbackDue = Math.max(0, targets.clawbackRewardTarget - clawedRewardPoints);
      let clawedDelta = 0;
      if (clawbackDue > 0 && availablePoints >= clawbackDue) {
        await tx.user.update({
          where: { id: order.userId },
          data: { availablePoints: { decrement: clawbackDue } },
        });
        availablePoints -= clawbackDue;
        clawedDelta = clawbackDue;
        clawedRewardPoints += clawbackDue;
        await tx.pointsRecord.create({
          data: {
            userId: order.userId,
            type: 2,
            points: clawbackDue,
            balance: availablePoints,
            source: CLAWBACK_RECONCILE_SOURCE,
            sourceId: latestRefund.id,
            description: `累计退款积分守恒补差，扣回订单完成奖励${clawbackDue}`,
          },
        });
      }

      const outstandingRewardClawback = Math.max(
        0,
        targets.clawbackRewardTarget - clawedRewardPoints,
      );
      const payload = {
        orderId: order.id.toString(),
        cumulativeRefundAmount: targets.cumulativeRefundAmount,
        restoreDeductedTarget: targets.restoreDeductedTarget,
        restoredPoints,
        clawbackRewardTarget: targets.clawbackRewardTarget,
        clawedRewardPoints,
        outstandingRewardClawback,
      };

      if (outstandingRewardClawback > 0) {
        await this.keepConservationTaskPending(tx, order.orderNo, transactionId, payload);
      } else {
        await this.finishConservationTask(tx, order.orderNo, transactionId, payload);
      }

      return { restoredDelta: restoreDelta, clawedDelta, outstandingRewardClawback };
    });
  }

  private async keepConservationTaskPending(
    tx: any,
    orderNo: string,
    transactionId: string,
    payload: Record<string, unknown>,
  ) {
    const task = await tx.paymentCompensationTask.findFirst({
      where: { orderNo, reason: REFUND_POINTS_CONSERVATION_REASON, transactionId },
    });
    const outstanding = Number(payload.outstandingRewardClawback || 0);
    const data = {
      amount: null,
      status: 'pending',
      callbackPayload: payload,
      handledBy: null,
      handledAt: null,
      resolution: `订单完成奖励积分仍有${outstanding}积分待自动扣回；用户余额不足时持续重试`,
    };
    if (task) {
      await tx.paymentCompensationTask.update({ where: { id: task.id }, data });
      return;
    }
    await tx.paymentCompensationTask.create({
      data: {
        orderNo,
        transactionId,
        reason: REFUND_POINTS_CONSERVATION_REASON,
        ...data,
      },
    });
  }

  private async finishConservationTask(
    tx: any,
    orderNo: string,
    transactionId: string,
    payload: Record<string, unknown>,
  ) {
    const task = await tx.paymentCompensationTask.findFirst({
      where: { orderNo, reason: REFUND_POINTS_CONSERVATION_REASON, transactionId },
    });
    const data = {
      amount: null,
      status: 'resolved',
      callbackPayload: payload,
      handledBy: 'system:refund-points-conservation',
      handledAt: new Date(),
      resolution: '累计成功退款金额与抵扣积分返还、订单完成奖励扣回已严格守恒',
    };
    if (task) {
      await tx.paymentCompensationTask.update({ where: { id: task.id }, data });
      return;
    }
    await tx.paymentCompensationTask.create({
      data: {
        orderNo,
        transactionId,
        reason: REFUND_POINTS_CONSERVATION_REASON,
        ...data,
      },
    });
  }
}
