import { Injectable, Logger } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { BusinessEventService } from '../common/business-event.service';
import { PAYMENT_STATUS, REFUND_STATUS } from '../common/constants';
import { PrismaService } from '../common/prisma/prisma.service';
import { PaymentService } from './payment.service';
import { ProductionPaymentReconcileService } from './production-payment-reconcile.service';

const CANCELLED_PAID_ANOMALY_REASON = 'cancelled_order_paid_historical_anomaly';
const CANCELLED_PAID_CALLBACK_REASON = 'cancelled_order_paid_callback';

interface CancelledPaidExposureRow {
  orderId: bigint;
  orderNo: string;
  payAmount: number | bigint;
  paymentId: bigint;
  paymentAmount: number | bigint;
  transactionId: string;
  countedRefundAmount: number | bigint;
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
    const anomalies = await this.seedCancelledPaidAnomalies();
    return { ...base, ...anomalies };
  }

  /**
   * Older deployments could cancel a local pending-payment order while a WeChat SUCCESS callback
   * was still in flight. New code prevents that race, but historical rows must still be surfaced.
   * This detector never changes payment/order/refund state and never initiates a refund. It only
   * creates a durable manual compensation task for the part of the paid amount that is not already
   * covered by an initiating/pending/processing/success refund.
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
            WHEN r.status IN (
              ${REFUND_STATUS.INITIATING},
              ${REFUND_STATUS.PENDING},
              ${REFUND_STATUS.PROCESSING},
              ${REFUND_STATUS.SUCCESS}
            ) THEN r.refund_amount
            ELSE 0
          END
        ), 0) AS countedRefundAmount
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
          WHEN r.status IN (
            ${REFUND_STATUS.INITIATING},
            ${REFUND_STATUS.PENDING},
            ${REFUND_STATUS.PROCESSING},
            ${REFUND_STATUS.SUCCESS}
          ) THEN r.refund_amount
          ELSE 0
        END
      ), 0) < o.pay_amount
      ORDER BY o.id ASC
      LIMIT ${limit}
    `;

    const exposed = candidates
      .map((row) => {
        const paidAmount = Math.max(0, Number(row.payAmount ?? row.paymentAmount ?? 0));
        const coveredRefundAmount = Math.max(0, Number(row.countedRefundAmount ?? 0));
        const outstandingAmount = Math.max(0, paidAmount - coveredRefundAmount);
        return { ...row, paidAmount, coveredRefundAmount, outstandingAmount };
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
        callbackPayload: {
          detectedBy: 'system:historical-cancelled-paid-reconcile',
          orderId: row.orderId.toString(),
          paymentId: row.paymentId.toString(),
          paidAmount: row.paidAmount,
          countedRefundAmount: row.coveredRefundAmount,
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
}
