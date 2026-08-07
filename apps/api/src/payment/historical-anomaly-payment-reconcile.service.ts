import { Injectable, Logger } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { BusinessEventService } from '../common/business-event.service';
import { PAYMENT_STATUS, REFUND_STATUS } from '../common/constants';
import { PrismaService } from '../common/prisma/prisma.service';
import { PaymentService } from './payment.service';
import { ProductionPaymentReconcileService } from './production-payment-reconcile.service';

const CANCELLED_PAID_ANOMALY_REASON = 'cancelled_order_paid_historical_anomaly';
const CANCELLED_PAID_CALLBACK_REASON = 'cancelled_order_paid_callback';
const CANCELLED_PAID_AMOUNT_MISMATCH_REASON = 'cancelled_order_paid_amount_mismatch';
const CANCELLED_PAID_TASK_REASONS = [
  CANCELLED_PAID_CALLBACK_REASON,
  CANCELLED_PAID_ANOMALY_REASON,
] as const;
const CANCELLED_PAID_DEDUPE_REASONS = [
  ...CANCELLED_PAID_TASK_REASONS,
  CANCELLED_PAID_AMOUNT_MISMATCH_REASON,
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

interface CancelledCreatedPaymentRow {
  orderId: bigint;
  orderNo: string;
  payAmount: number | bigint;
  paymentId: bigint;
  paymentAmount: number | bigint;
  paymentUpdatedAt: Date;
}

@Injectable()
export class HistoricalAnomalyPaymentReconcileService extends ProductionPaymentReconcileService {
  private readonly historicalLogger = new Logger(HistoricalAnomalyPaymentReconcileService.name);

  constructor(
    private readonly historicalPrisma: PrismaService,
    private readonly historicalPaymentService: PaymentService,
    businessEvent: BusinessEventService,
  ) {
    super(historicalPrisma, historicalPaymentService, businessEvent);
  }

  override async reconcilePendingPayments() {
    const base = await super.reconcilePendingPayments();
    const createdPayments = await this.reconcileCancelledCreatedPayments();
    const refreshed = await this.reconcileExistingCancelledPaidTasks();
    const anomalies = await this.seedCancelledPaidAnomalies();
    return { ...base, ...createdPayments, ...refreshed, ...anomalies };
  }

  /**
   * A historical cancelled order may still have a local CREATED payment even though the remote
   * WeChat transaction is authoritative. Query WeChat before changing anything. SUCCESS only
   * synchronizes the payment fact; it never reactivates the cancelled order and never refunds
   * automatically. NOTPAY is remotely closed first. Ambiguous states stay CREATED and rotate.
   */
  private async reconcileCancelledCreatedPayments(limit = 50) {
    const candidates = await this.historicalPrisma.$queryRaw<CancelledCreatedPaymentRow[]>`
      SELECT
        o.id AS orderId,
        o.order_no AS orderNo,
        o.pay_amount AS payAmount,
        p.id AS paymentId,
        p.amount AS paymentAmount,
        p.updated_at AS paymentUpdatedAt
      FROM order_payments p
      INNER JOIN orders o ON o.id = p.order_id
      WHERE o.status = ${OrderStatus.cancelled}
        AND o.pay_amount > 0
        AND p.status = ${PAYMENT_STATUS.CREATED}
        AND p.payment_method = 'wechat'
      ORDER BY p.updated_at ASC
      LIMIT ${limit}
    `;

    let cancelledCreatedSuccess = 0;
    let cancelledCreatedClosed = 0;
    let cancelledCreatedPending = 0;
    let cancelledCreatedMismatch = 0;
    let cancelledCreatedFailed = 0;

    for (const candidate of candidates) {
      if (!this.historicalPaymentService.isPaymentStatusSyncAvailable()) {
        await this.touchCreatedPayment(candidate.paymentId, {
          detector: 'historical-cancelled-created-payment',
          state: 'sync_unavailable',
          checkedAt: new Date().toISOString(),
        });
        cancelledCreatedPending += 1;
        continue;
      }

      try {
        const result = await this.historicalPaymentService.queryWechatOrder(candidate.orderNo);
        const outcome = await this.applyCreatedPaymentWechatState(candidate, result);
        if (outcome === 'success') cancelledCreatedSuccess += 1;
        else if (outcome === 'closed') cancelledCreatedClosed += 1;
        else if (outcome === 'mismatch') cancelledCreatedMismatch += 1;
        else cancelledCreatedPending += 1;
      } catch (error) {
        const code = this.wechatErrorCode(error);
        if (code === 'ORDER_NOT_EXIST') {
          await this.markCreatedPaymentFailed(candidate.paymentId, 'ORDER_NOT_EXIST', {
            detector: 'historical-cancelled-created-payment',
            code,
            checkedAt: new Date().toISOString(),
          });
          cancelledCreatedClosed += 1;
          continue;
        }

        cancelledCreatedFailed += 1;
        cancelledCreatedPending += 1;
        await this.touchCreatedPayment(candidate.paymentId, {
          detector: 'historical-cancelled-created-payment',
          state: 'query_failed',
          error: (error as Error).message,
          code: code || null,
          checkedAt: new Date().toISOString(),
        });
      }
    }

    return {
      cancelledCreatedChecked: candidates.length,
      cancelledCreatedSuccess,
      cancelledCreatedClosed,
      cancelledCreatedPending,
      cancelledCreatedMismatch,
      cancelledCreatedFailed,
    };
  }

  private async applyCreatedPaymentWechatState(
    candidate: CancelledCreatedPaymentRow,
    result: any,
  ): Promise<'success' | 'closed' | 'pending' | 'mismatch'> {
    const tradeState = result?.trade_state;

    if (tradeState === 'SUCCESS') {
      return this.syncCreatedPaymentSuccess(candidate, result);
    }

    if (tradeState === 'CLOSED' || tradeState === 'REVOKED' || tradeState === 'PAYERROR') {
      await this.markCreatedPaymentFailed(candidate.paymentId, tradeState, result);
      return 'closed';
    }

    if (tradeState === 'NOTPAY') {
      const closeFn = (this.historicalPaymentService as any).closeWechatOrderForCancellation;
      if (typeof closeFn !== 'function') {
        await this.touchCreatedPayment(candidate.paymentId, {
          detector: 'historical-cancelled-created-payment',
          state: 'wechat_close_capability_unavailable',
          wechat: result,
          checkedAt: new Date().toISOString(),
        });
        return 'pending';
      }

      try {
        await closeFn.call(this.historicalPaymentService, candidate.orderNo);
        await this.markCreatedPaymentFailed(candidate.paymentId, 'CLOSED_BY_MERCHANT', result);
        return 'closed';
      } catch (closeError) {
        return this.resolveCreatedPaymentAfterCloseFailure(candidate, closeError);
      }
    }

    await this.touchCreatedPayment(candidate.paymentId, {
      detector: 'historical-cancelled-created-payment',
      state: tradeState || 'unknown',
      wechat: result,
      checkedAt: new Date().toISOString(),
    });
    return 'pending';
  }

  private async resolveCreatedPaymentAfterCloseFailure(
    candidate: CancelledCreatedPaymentRow,
    closeError: unknown,
  ): Promise<'success' | 'closed' | 'pending' | 'mismatch'> {
    try {
      const result = await this.historicalPaymentService.queryWechatOrder(candidate.orderNo);
      const tradeState = result?.trade_state;
      if (tradeState === 'SUCCESS') {
        return this.syncCreatedPaymentSuccess(candidate, result);
      }
      if (tradeState === 'CLOSED' || tradeState === 'REVOKED' || tradeState === 'PAYERROR') {
        await this.markCreatedPaymentFailed(candidate.paymentId, tradeState, result);
        return 'closed';
      }

      await this.touchCreatedPayment(candidate.paymentId, {
        detector: 'historical-cancelled-created-payment',
        state: `close_failed_then_${tradeState || 'unknown'}`,
        closeError: (closeError as Error).message,
        wechat: result,
        checkedAt: new Date().toISOString(),
      });
      return 'pending';
    } catch (queryError) {
      const code = this.wechatErrorCode(queryError);
      if (code === 'ORDER_NOT_EXIST') {
        await this.markCreatedPaymentFailed(candidate.paymentId, 'ORDER_NOT_EXIST', {
          detector: 'historical-cancelled-created-payment',
          closeError: (closeError as Error).message,
          code,
          checkedAt: new Date().toISOString(),
        });
        return 'closed';
      }

      await this.touchCreatedPayment(candidate.paymentId, {
        detector: 'historical-cancelled-created-payment',
        state: 'close_and_query_failed',
        closeError: (closeError as Error).message,
        queryError: (queryError as Error).message,
        code: code || null,
        checkedAt: new Date().toISOString(),
      });
      return 'pending';
    }
  }

  private async syncCreatedPaymentSuccess(
    candidate: CancelledCreatedPaymentRow,
    result: any,
  ): Promise<'success' | 'pending' | 'mismatch'> {
    const transactionId = typeof result?.transaction_id === 'string'
      ? result.transaction_id.trim()
      : '';
    const wechatAmount = Number(result?.amount?.total);
    const expectedAmount = Number(candidate.payAmount ?? candidate.paymentAmount ?? 0);

    if (!transactionId || !Number.isInteger(wechatAmount) || wechatAmount <= 0) {
      await this.touchCreatedPayment(candidate.paymentId, {
        detector: 'historical-cancelled-created-payment',
        state: 'invalid_wechat_success_payload',
        wechat: result,
        checkedAt: new Date().toISOString(),
      });
      return 'pending';
    }

    const paidAt = this.parseWechatSuccessTime(result?.success_time);
    const synced = await this.historicalPrisma.orderPayment.updateMany({
      where: { id: candidate.paymentId, status: PAYMENT_STATUS.CREATED },
      data: {
        status: PAYMENT_STATUS.SUCCESS,
        transactionId,
        paidAt,
        rawResponse: result,
      },
    });
    if (synced.count === 0) {
      return 'pending';
    }

    if (wechatAmount !== expectedAmount) {
      await this.historicalPrisma.paymentCompensationTask.createMany({
        data: [{
          orderNo: candidate.orderNo,
          transactionId,
          amount: wechatAmount,
          reason: CANCELLED_PAID_AMOUNT_MISMATCH_REASON,
          status: 'pending',
          resolution: `历史取消订单微信实际支付${wechatAmount}分，与本地订单应付${expectedAmount}分不一致，禁止自动处理，需人工核账`,
          callbackPayload: {
            detectedBy: 'system:historical-cancelled-created-payment',
            orderId: candidate.orderId.toString(),
            paymentId: candidate.paymentId.toString(),
            expectedAmount,
            wechatAmount,
            wechat: result,
          },
        }],
        skipDuplicates: true,
      });
      this.historicalLogger.error(
        `历史取消订单支付金额不一致: order=${candidate.orderNo}, expected=${expectedAmount}, wechat=${wechatAmount}`,
      );
      return 'mismatch';
    }

    this.historicalLogger.error(
      `检测到历史取消订单微信已支付但本地仍CREATED: order=${candidate.orderNo}, transactionId=${transactionId}。已同步支付事实，未自动退款。`,
    );
    return 'success';
  }

  private async markCreatedPaymentFailed(paymentId: bigint, terminalState: string, raw: unknown) {
    await this.historicalPrisma.orderPayment.updateMany({
      where: { id: paymentId, status: PAYMENT_STATUS.CREATED },
      data: {
        status: PAYMENT_STATUS.FAILED,
        rawResponse: {
          detector: 'historical-cancelled-created-payment',
          terminalState,
          wechat: raw as any,
          checkedAt: new Date().toISOString(),
        },
      },
    });
  }

  private async touchCreatedPayment(paymentId: bigint, rawResponse: Record<string, unknown>) {
    await this.historicalPrisma.orderPayment.updateMany({
      where: { id: paymentId, status: PAYMENT_STATUS.CREATED },
      data: { rawResponse: rawResponse as any },
    });
  }

  private parseWechatSuccessTime(value: unknown) {
    if (typeof value === 'string' && value.trim()) {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return new Date();
  }

  private wechatErrorCode(error: unknown): string | undefined {
    return (error as any)?.response?.data?.code;
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
              ${CANCELLED_PAID_ANOMALY_REASON},
              ${CANCELLED_PAID_AMOUNT_MISMATCH_REASON}
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
