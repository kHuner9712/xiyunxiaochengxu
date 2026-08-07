import { Injectable, Logger } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { BusinessEventService } from '../common/business-event.service';
import { PAYMENT_STATUS, REFUND_STATUS } from '../common/constants';
import { PrismaService } from '../common/prisma/prisma.service';
import { PaymentService } from './payment.service';
import { ProductionPaymentReconcileService } from './production-payment-reconcile.service';

const CANCELLED_PAID_ANOMALY_REASON = 'cancelled_order_paid_historical_anomaly';
const CANCELLED_PAID_CALLBACK_REASON = 'cancelled_order_paid_callback';
const CANCELLED_PAID_TASK_REASONS = [
  CANCELLED_PAID_CALLBACK_REASON,
  CANCELLED_PAID_ANOMALY_REASON,
] as const;
const ACTIVE_REFUND_STATUSES = new Set<string>([
  REFUND_STATUS.INITIATING,
  REFUND_STATUS.PENDING,
  REFUND_STATUS.PROCESSING,
]);

interface CancelledPaidExposureRow {
  orderId: bigint;
  orderNo: string;
  payAmount: number | bigint;
  paymentId: bigint;
  paymentAmount: number | bigint;
  transactionId: string;
  successfulRefundAmount: number | bigint;
  activeRefundAmount: number | bigint;
}

@Injectable()
export class HistoricalAnomalyPaymentReconcileService extends ProductionPaymentReconcileService {
  private readonly historicalLogger = new Logger(HistoricalAnomalyPaymentReconcileService.name);

  constructor(
    private readonly historicalPrisma: PrismaService,
    paymentService: PaymentService,
    businessEvent: BusinessEventService,
  ) {
    super(historicalPrisma, paymentService, businessEvent);
  }

  override async reconcilePendingPayments() {
    const base = await super.reconcilePendingPayments();
    const refreshed = await this.reconcileExistingCancelledPaidTasks();
    const anomalies = await this.seedCancelledPaidAnomalies();
    return { ...base, ...refreshed, ...anomalies };
  }

  /**
   * Existing tasks must follow the money, not the request state. Only SUCCESS refunds prove that
   * money was returned. A pending/processing refund is shown as in-flight but never reduces the
   * task amount and never auto-resolves a task. This prevents a later CLOSED/ABNORMAL refund from
   * leaving an already-resolved task while the customer still has financial exposure.
   */
  private async reconcileExistingCancelledPaidTasks(limit = 200) {
    const tasks = await this.historicalPrisma.paymentCompensationTask.findMany({
      where: {
        status: 'pending',
        reason: { in: [...CANCELLED_PAID_TASK_REASONS] },
      },
      orderBy: { updatedAt: 'asc' },
      take: limit,
    });

    let historicalTasksResolved = 0;
    let historicalTasksRefreshed = 0;
    let historicalTasksFailed = 0;

    for (const task of tasks) {
      try {
        const order = await this.historicalPrisma.order.findFirst({
          where: { orderNo: task.orderNo },
          include: {
            payment: true,
            orderRefunds: {
              select: {
                id: true,
                status: true,
                refundAmount: true,
                outRefundNo: true,
              },
            },
          },
        });

        if (!order?.payment) {
          historicalTasksFailed += 1;
          await this.historicalPrisma.paymentCompensationTask.updateMany({
            where: { id: task.id, status: 'pending' },
            data: {
              resolution: '自动复核失败：补偿任务对应订单或支付记录不存在，需人工核对',
            },
          });
          continue;
        }

        const paidAmount = Math.max(0, Number(order.payAmount ?? order.payment.amount ?? task.amount ?? 0));
        const successfulRefundAmount = order.orderRefunds
          .filter((refund) => refund.status === REFUND_STATUS.SUCCESS)
          .reduce((sum, refund) => sum + Math.max(0, refund.refundAmount || 0), 0);
        const activeRefundAmount = order.orderRefunds
          .filter((refund) => ACTIVE_REFUND_STATUSES.has(refund.status))
          .reduce((sum, refund) => sum + Math.max(0, refund.refundAmount || 0), 0);
        const outstandingAmount = Math.max(0, paidAmount - successfulRefundAmount);
        const originalPayload = this.asPayloadObject(task.callbackPayload);
        const reconciliation = {
          checkedAt: new Date().toISOString(),
          orderId: order.id.toString(),
          paymentId: order.payment.id.toString(),
          paidAmount,
          successfulRefundAmount,
          activeRefundAmount,
          outstandingAmount,
          orderStatus: order.status,
          activeRefunds: order.orderRefunds
            .filter((refund) => ACTIVE_REFUND_STATUSES.has(refund.status))
            .map((refund) => ({
              refundId: refund.id.toString(),
              outRefundNo: refund.outRefundNo,
              status: refund.status,
              refundAmount: refund.refundAmount,
            })),
        };

        if (outstandingAmount <= 0) {
          const resolved = await this.historicalPrisma.paymentCompensationTask.updateMany({
            where: { id: task.id, status: 'pending' },
            data: {
              amount: 0,
              status: 'resolved',
              handledBy: 'system:historical-cancelled-paid-reconcile',
              handledAt: new Date(),
              resolution: `微信成功退款已覆盖全部实付金额${paidAmount}分，历史取消后支付异常已自动闭环`,
              callbackPayload: {
                ...originalPayload,
                reconciliation,
              },
            },
          });
          if (resolved.count > 0) historicalTasksResolved += 1;
          continue;
        }

        const resolution = activeRefundAmount > 0
          ? `当前仍有${outstandingAmount}分尚未被成功退款证明退回；另有${activeRefundAmount}分退款处理中，任务保持待处理直至微信确认SUCCESS`
          : `当前仍有${outstandingAmount}分尚未被成功退款证明退回，任务保持待处理`;
        const refreshed = await this.historicalPrisma.paymentCompensationTask.updateMany({
          where: { id: task.id, status: 'pending' },
          data: {
            amount: outstandingAmount,
            resolution,
            callbackPayload: {
              ...originalPayload,
              reconciliation,
            },
          },
        });
        if (refreshed.count > 0) historicalTasksRefreshed += 1;
      } catch (error) {
        historicalTasksFailed += 1;
        this.historicalLogger.error(
          `历史取消后支付补偿任务复核失败: taskId=${task.id}, error=${(error as Error).message}`,
        );
      }
    }

    return {
      historicalTasksChecked: tasks.length,
      historicalTasksResolved,
      historicalTasksRefreshed,
      historicalTasksFailed,
    };
  }

  /**
   * Older deployments could cancel a local pending-payment order while a WeChat SUCCESS callback
   * was still in flight. New code prevents that race, but historical rows must still be surfaced.
   * This detector never changes payment/order/refund state and never initiates a refund. Task
   * amount is paid money not yet proven returned by a SUCCESS refund; in-flight refunds are only
   * recorded as operational context.
   */
  private async seedCancelledPaidAnomalies(limit = 200) {
    const candidates = await this.historicalPrisma.$queryRaw<CancelledPaidExposureRow[]>`
      SELECT
        o.id AS orderId,
        o.order_no AS orderNo,
        o.pay_amount AS payAmount,
        p.id AS paymentId,
        p.amount AS paymentAmount,
        p.transaction_id AS transactionId,
        COALESCE(SUM(
          CASE
            WHEN r.status = ${REFUND_STATUS.SUCCESS} THEN r.refund_amount
            ELSE 0
          END
        ), 0) AS successfulRefundAmount,
        COALESCE(SUM(
          CASE
            WHEN r.status IN (
              ${REFUND_STATUS.INITIATING},
              ${REFUND_STATUS.PENDING},
              ${REFUND_STATUS.PROCESSING}
            ) THEN r.refund_amount
            ELSE 0
          END
        ), 0) AS activeRefundAmount
      FROM orders o
      INNER JOIN order_payments p ON p.order_id = o.id
      LEFT JOIN order_refunds r ON r.order_id = o.id
      WHERE o.status = ${OrderStatus.cancelled}
        AND o.pay_amount > 0
        AND p.status = ${PAYMENT_STATUS.SUCCESS}
        AND p.payment_method = 'wechat'
        AND p.transaction_id IS NOT NULL
        AND p.transaction_id <> ''
        AND NOT EXISTS (
          SELECT 1
          FROM payment_compensation_tasks t
          WHERE t.order_no = o.order_no
            AND t.transaction_id = p.transaction_id
            AND t.reason IN (
              ${CANCELLED_PAID_CALLBACK_REASON},
              ${CANCELLED_PAID_ANOMALY_REASON}
            )
        )
      GROUP BY
        o.id,
        o.order_no,
        o.pay_amount,
        p.id,
        p.amount,
        p.transaction_id
      HAVING COALESCE(SUM(
        CASE
          WHEN r.status = ${REFUND_STATUS.SUCCESS} THEN r.refund_amount
          ELSE 0
        END
      ), 0) < o.pay_amount
      ORDER BY o.id ASC
      LIMIT ${limit}
    `;

    const exposed = candidates
      .map((row) => {
        const paidAmount = Math.max(0, Number(row.payAmount ?? row.paymentAmount ?? 0));
        const successfulRefundAmount = Math.max(0, Number(row.successfulRefundAmount ?? 0));
        const activeRefundAmount = Math.max(0, Number(row.activeRefundAmount ?? 0));
        const outstandingAmount = Math.max(0, paidAmount - successfulRefundAmount);
        return {
          ...row,
          paidAmount,
          successfulRefundAmount,
          activeRefundAmount,
          outstandingAmount,
        };
      })
      .filter((row) => row.transactionId && row.outstandingAmount > 0);

    if (exposed.length === 0) {
      return { cancelledPaidDetected: 0, cancelledPaidSeeded: 0 };
    }

    const inserted = await this.historicalPrisma.paymentCompensationTask.createMany({
      data: exposed.map((row) => ({
        orderNo: row.orderNo,
        transactionId: row.transactionId,
        amount: row.outstandingAmount,
        reason: CANCELLED_PAID_ANOMALY_REASON,
        status: 'pending',
        resolution: row.activeRefundAmount > 0
          ? `检测到历史取消后支付成功异常；当前另有${row.activeRefundAmount}分退款处理中，待微信确认SUCCESS后再减少资金敞口`
          : '检测到历史取消后支付成功异常，等待人工核对或成功退款闭环',
        callbackPayload: {
          detectedBy: 'system:historical-cancelled-paid-reconcile',
          orderId: row.orderId.toString(),
          paymentId: row.paymentId.toString(),
          paidAmount: row.paidAmount,
          successfulRefundAmount: row.successfulRefundAmount,
          activeRefundAmount: row.activeRefundAmount,
          outstandingAmount: row.outstandingAmount,
        },
      })),
      skipDuplicates: true,
    });

    if (inserted.count > 0) {
      this.historicalLogger.error(
        `检测到历史取消后支付成功资金异常: detected=${exposed.length}, seeded=${inserted.count}。仅创建人工补偿任务，未自动退款。`,
      );
    }

    return {
      cancelledPaidDetected: exposed.length,
      cancelledPaidSeeded: inserted.count,
    };
  }

  private asPayloadObject(payload: unknown): Record<string, unknown> {
    return payload && typeof payload === 'object' && !Array.isArray(payload)
      ? { ...(payload as Record<string, unknown>) }
      : {};
  }
}
