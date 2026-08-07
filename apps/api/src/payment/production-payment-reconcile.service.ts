import { Injectable, Logger } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { BusinessEventService } from '../common/business-event.service';
import { PAYMENT_STATUS, REFUND_STATUS } from '../common/constants';
import { PrismaService } from '../common/prisma/prisma.service';
import { PaymentReconcileService } from './payment-reconcile.service';
import { PaymentService } from './payment.service';

@Injectable()
export class ProductionPaymentReconcileService extends PaymentReconcileService {
  private readonly productionLogger = new Logger(ProductionPaymentReconcileService.name);
  private readonly closeDelayMs = 5 * 60 * 1000;

  constructor(
    private readonly productionPrisma: PrismaService,
    private readonly productionPaymentService: PaymentService,
    private readonly productionBusinessEvent: BusinessEventService,
  ) {
    super(productionPrisma, productionPaymentService, productionBusinessEvent);
  }

  override async confirmTimeoutOrdersBeforeClose() {
    const timeoutOrders = await this.productionPrisma.order.findMany({
      where: {
        status: OrderStatus.pending_payment,
        autoCloseAt: { lte: new Date() },
      },
      include: { payment: true },
    });

    if (timeoutOrders.length === 0) {
      return { total: 0, fixed: 0, delayed: 0, closable: 0, failed: 0 };
    }

    let fixed = 0;
    let delayed = 0;
    let closable = 0;
    let failed = 0;

    for (const order of timeoutOrders) {
      const payment = order.payment;
      if (!payment) {
        closable += 1;
        continue;
      }

      if (!this.productionPaymentService.isPaymentStatusSyncAvailable()) {
        await this.delayAutoClose(order.id, 'wechat_payment_sync_unavailable');
        delayed += 1;
        continue;
      }

      try {
        if (payment.status === PAYMENT_STATUS.SUCCESS && payment.transactionId) {
          await this.productionPaymentService.processPaymentSuccess(
            payment.id,
            order.id,
            payment.transactionId,
            null,
            order,
          );
          fixed += 1;
          continue;
        }

        const wechatResult = await this.productionPaymentService.queryWechatOrder(order.orderNo);
        const tradeState = wechatResult?.trade_state;

        if (tradeState === 'SUCCESS') {
          await this.productionPaymentService.processPaymentSuccess(
            payment.id,
            order.id,
            wechatResult.transaction_id,
            wechatResult.amount?.total,
            order,
          );
          fixed += 1;
          continue;
        }

        if (tradeState === 'CLOSED' || tradeState === 'REVOKED' || tradeState === 'PAYERROR') {
          await this.markPaymentDefinitivelyClosed(payment.id, tradeState);
          closable += 1;
          continue;
        }

        if (tradeState === 'NOTPAY') {
          const closeFn = (this.productionPaymentService as any).closeWechatOrderForCancellation;
          if (typeof closeFn !== 'function') {
            await this.delayAutoClose(order.id, 'wechat_close_capability_unavailable');
            delayed += 1;
            continue;
          }

          try {
            await closeFn.call(this.productionPaymentService, order.orderNo);
            await this.markPaymentDefinitivelyClosed(payment.id, 'CLOSED_BY_MERCHANT');
            closable += 1;
            continue;
          } catch (closeError) {
            const resolved = await this.resolveAfterCloseFailure(order, payment, closeError);
            fixed += resolved.fixed;
            closable += resolved.closable;
            delayed += resolved.delayed;
            failed += resolved.failed;
            continue;
          }
        }

        await this.delayAutoClose(order.id, `trade_state=${tradeState || 'unknown'}`);
        delayed += 1;
      } catch (error) {
        const code = this.wechatErrorCode(error);
        if (code === 'ORDER_NOT_EXIST') {
          await this.markPaymentDefinitivelyClosed(payment.id, 'ORDER_NOT_EXIST');
          closable += 1;
          continue;
        }

        failed += 1;
        await this.delayAutoClose(order.id, `query_error=${(error as Error).message}`);
        delayed += 1;
      }
    }

    return { total: timeoutOrders.length, fixed, delayed, closable, failed };
  }

  /**
   * Base reconciliation owns initiating/pending/processing refunds. ABNORMAL is intentionally
   * excluded there because it cannot be retried safely. This production extension only observes
   * old ABNORMAL records through syncRefund: if a merchant has resolved the refund in WeChat,
   * the outer PaymentService can move it into PROCESSING/CLOSED/SUCCESS safely. Still-abnormal
   * records are merely observed and rotated; they are never re-submitted as new refunds.
   */
  override async reconcilePendingRefunds() {
    const base = await super.reconcilePendingRefunds();
    const staleBefore = new Date(Date.now() - 5 * 60 * 1000);
    const abnormalRefunds = await this.productionPrisma.orderRefund.findMany({
      where: {
        status: REFUND_STATUS.ABNORMAL,
        updatedAt: { lt: staleBefore },
      },
      orderBy: { updatedAt: 'asc' },
      take: 100,
      select: {
        id: true,
        outRefundNo: true,
      },
    });

    let abnormalRecovered = 0;
    let abnormalStillAbnormal = 0;
    let abnormalFailed = 0;

    for (const refund of abnormalRefunds) {
      try {
        const result = await this.productionPaymentService.syncRefund(refund.outRefundNo);
        const status = (result as any)?.status;
        if (
          status === REFUND_STATUS.SUCCESS ||
          status === REFUND_STATUS.PENDING ||
          status === REFUND_STATUS.CLOSED
        ) {
          abnormalRecovered += 1;
          this.productionLogger.log(
            `异常退款自动同步收敛: outRefundNo=${refund.outRefundNo}, status=${status}`,
          );
        } else {
          abnormalStillAbnormal += 1;
        }
      } catch (error) {
        abnormalFailed += 1;
        this.productionLogger.error(
          `异常退款自动同步失败: outRefundNo=${refund.outRefundNo}, error=${(error as Error).message}`,
        );
      }
    }

    return {
      ...base,
      abnormalTotal: abnormalRefunds.length,
      abnormalRecovered,
      abnormalStillAbnormal,
      abnormalFailed,
    };
  }

  private async resolveAfterCloseFailure(order: any, payment: any, closeError: unknown) {
    try {
      const result = await this.productionPaymentService.queryWechatOrder(order.orderNo);
      const tradeState = result?.trade_state;
      if (tradeState === 'SUCCESS') {
        await this.productionPaymentService.processPaymentSuccess(
          payment.id,
          order.id,
          result.transaction_id,
          result.amount?.total,
          order,
        );
        return { fixed: 1, closable: 0, delayed: 0, failed: 0 };
      }
      if (tradeState === 'CLOSED' || tradeState === 'REVOKED' || tradeState === 'PAYERROR') {
        await this.markPaymentDefinitivelyClosed(payment.id, tradeState);
        return { fixed: 0, closable: 1, delayed: 0, failed: 0 };
      }

      await this.delayAutoClose(
        order.id,
        `close_failed_then_trade_state=${tradeState || 'unknown'}`,
      );
      return { fixed: 0, closable: 0, delayed: 1, failed: 1 };
    } catch (queryError) {
      const code = this.wechatErrorCode(queryError);
      if (code === 'ORDER_NOT_EXIST') {
        await this.markPaymentDefinitivelyClosed(payment.id, 'ORDER_NOT_EXIST');
        return { fixed: 0, closable: 1, delayed: 0, failed: 0 };
      }

      this.productionLogger.warn(
        `微信关单失败且复查状态失败: order=${order.orderNo}, close=${(closeError as Error).message}, query=${(queryError as Error).message}`,
      );
      await this.delayAutoClose(order.id, `close_and_query_failed=${(queryError as Error).message}`);
      return { fixed: 0, closable: 0, delayed: 1, failed: 1 };
    }
  }

  private async markPaymentDefinitivelyClosed(paymentId: bigint, reason: string) {
    await this.productionPrisma.orderPayment.updateMany({
      where: { id: paymentId, status: { not: PAYMENT_STATUS.SUCCESS } },
      data: {
        status: PAYMENT_STATUS.FAILED,
        rawResponse: { terminalState: reason },
      },
    });
  }

  private async delayAutoClose(orderId: bigint, reason: string) {
    const nextCloseAt = new Date(Date.now() + this.closeDelayMs);
    await this.productionPrisma.order.update({
      where: { id: orderId },
      data: { autoCloseAt: nextCloseAt },
    });
    await this.productionPrisma.orderLog.create({
      data: {
        orderId,
        operatorType: 'system',
        action: 'auto_close_delay',
        content: `关单前微信支付状态未形成安全终态，延迟关闭。原因：${reason}`,
      },
    });
    this.productionBusinessEvent.emitWarn(
      'order_auto_close_delayed_for_payment_confirm',
      'payment',
      `订单${orderId.toString()} 关单前支付确认未完成，已延迟关闭`,
      orderId.toString(),
      { reason, nextCloseAt: nextCloseAt.toISOString() },
    );
  }

  private wechatErrorCode(error: unknown): string | undefined {
    return (error as any)?.response?.data?.code;
  }
}
