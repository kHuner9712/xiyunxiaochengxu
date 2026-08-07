import { Injectable, Logger } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { BusinessEventService } from '../common/business-event.service';
import { PAYMENT_STATUS, REFUND_STATUS } from '../common/constants';
import { PrismaService } from '../common/prisma/prisma.service';
import { PaymentService } from './payment.service';
import { ProductionPaymentReconcileService } from './production-payment-reconcile.service';

const CANCELLED_PAID_ANOMALY_REASON = 'cancelled_order_paid_historical_anomaly';
const COUNTED_REFUND_STATUSES = new Set<string>([
  REFUND_STATUS.INITIATING,
  REFUND_STATUS.PENDING,
  REFUND_STATUS.PROCESSING,
  REFUND_STATUS.SUCCESS,
]);

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
   * This detector is intentionally read-only with respect to order/payment/refund state: it only
   * creates a durable manual compensation task for the still-unrefunded financial exposure.
   */
  private async seedCancelledPaidAnomalies(limit = 200) {
    const candidates = await this.historicalPrisma.order.findMany({
      where: {
        status: OrderStatus.cancelled,
        payAmount: { gt: 0 },
        payment: {
          is: {
            status: PAYMENT_STATUS.SUCCESS,
            paymentMethod: 'wechat',
            transactionId: { not: null },
          },
        },
      },
      select: {
        id: true,
        orderNo: true,
        payAmount: true,
        payment: {
          select: {
            id: true,
            amount: true,
            transactionId: true,
          },
        },
        orderRefunds: {
          select: {
            id: true,
            refundAmount: true,
            status: true,
            outRefundNo: true,
          },
        },
      },
      orderBy: { id: 'asc' },
      take: limit * 5,
    });

    if (candidates.length === 0) {
      return { cancelledPaidDetected: 0, cancelledPaidSeeded: 0 };
    }

    const existingTasks = await this.historicalPrisma.paymentCompensationTask.findMany({
      where: {
        reason: CANCELLED_PAID_ANOMALY_REASON,
        orderNo: { in: candidates.map((order) => order.orderNo) },
      },
      select: { orderNo: true, transactionId: true },
    });
    const existingKeys = new Set(
      existingTasks.map((task) => `${task.orderNo}:${task.transactionId ?? ''}`),
    );

    const exposed = candidates
      .map((order) => {
        const transactionId = order.payment?.transactionId || null;
        const paidAmount = Math.max(0, order.payAmount ?? order.payment?.amount ?? 0);
        const coveredRefundAmount = order.orderRefunds
          .filter((refund) => COUNTED_REFUND_STATUSES.has(refund.status))
          .reduce((sum, refund) => sum + Math.max(0, refund.refundAmount || 0), 0);
        const outstandingAmount = Math.max(0, paidAmount - coveredRefundAmount);
        return {
          order,
          transactionId,
          paidAmount,
          coveredRefundAmount,
          outstandingAmount,
        };
      })
      .filter((item) => item.transactionId && item.outstandingAmount > 0)
      .filter((item) => !existingKeys.has(`${item.order.orderNo}:${item.transactionId}`))
      .slice(0, limit);

    if (exposed.length === 0) {
      return { cancelledPaidDetected: 0, cancelledPaidSeeded: 0 };
    }

    const inserted = await this.historicalPrisma.paymentCompensationTask.createMany({
      data: exposed.map((item) => ({
        orderNo: item.order.orderNo,
        transactionId: item.transactionId!,
        amount: item.outstandingAmount,
        reason: CANCELLED_PAID_ANOMALY_REASON,
        status: 'pending',
        callbackPayload: {
          detectedBy: 'system:historical-cancelled-paid-reconcile',
          orderId: item.order.id.toString(),
          paymentId: item.order.payment?.id.toString() ?? null,
          paidAmount: item.paidAmount,
          countedRefundAmount: item.coveredRefundAmount,
          outstandingAmount: item.outstandingAmount,
          countedRefunds: item.order.orderRefunds
            .filter((refund) => COUNTED_REFUND_STATUSES.has(refund.status))
            .map((refund) => ({
              refundId: refund.id.toString(),
              outRefundNo: refund.outRefundNo,
              status: refund.status,
              refundAmount: refund.refundAmount,
            })),
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
