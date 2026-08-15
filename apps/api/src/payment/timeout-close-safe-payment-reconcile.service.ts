import { Injectable, Logger } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { BusinessEventService } from '../common/business-event.service';
import { PAYMENT_STATUS } from '../common/constants';
import { PrismaService } from '../common/prisma/prisma.service';
import { HistoricalAnomalyPaymentReconcileService } from './historical-anomaly-payment-reconcile.service';
import { PaymentService } from './payment.service';

const TIMEOUT_CLOSE_CONFIRM_BATCH_SIZE = 20;
const TERMINAL_WECHAT_PAYMENT_STATES = new Set(['CLOSED', 'REVOKED', 'PAYERROR']);

@Injectable()
export class TimeoutCloseSafePaymentReconcileService extends HistoricalAnomalyPaymentReconcileService {
  private readonly timeoutCloseLogger = new Logger(TimeoutCloseSafePaymentReconcileService.name);
  private readonly closeDelayMs = 5 * 60 * 1000;

  constructor(
    private readonly timeoutClosePrisma: PrismaService,
    private readonly timeoutClosePaymentService: PaymentService,
    businessEvent: BusinessEventService,
  ) {
    super(timeoutClosePrisma, timeoutClosePaymentService, businessEvent);
  }

  override async confirmTimeoutOrdersBeforeClose() {
    const timeoutOrders = await this.timeoutClosePrisma.order.findMany({
      where: {
        status: OrderStatus.pending_payment,
        autoCloseAt: { lte: new Date() },
      },
      include: { payment: true },
      orderBy: [{ autoCloseAt: 'asc' }, { id: 'asc' }],
      take: TIMEOUT_CLOSE_CONFIRM_BATCH_SIZE,
    });

    if (timeoutOrders.length === 0) {
      return { total: 0, fixed: 0, delayed: 0, closable: 0, failed: 0 };
    }

    if (!this.timeoutClosePaymentService.isPaymentStatusSyncAvailable()) {
      return {
        total: timeoutOrders.length,
        fixed: 0,
        delayed: timeoutOrders.filter((order) => order.payment?.status === PAYMENT_STATUS.CREATED).length,
        closable: timeoutOrders.filter((order) => !order.payment || order.payment.status !== PAYMENT_STATUS.CREATED).length,
        failed: 0,
      };
    }

    let fixed = 0;
    let delayed = 0;
    let closable = 0;
    let failed = 0;

    for (const order of timeoutOrders) {
      const payment = order.payment;
      if (!payment || payment.status !== PAYMENT_STATUS.CREATED) {
        closable += 1;
        continue;
      }

      try {
        const wechatResult = await this.timeoutClosePaymentService.queryWechatOrder(order.orderNo);
        const tradeState = wechatResult?.trade_state;

        if (tradeState === 'SUCCESS') {
          await this.timeoutClosePaymentService.processPaymentSuccess(
            payment.id,
            order.id,
            wechatResult.transaction_id,
            wechatResult.amount?.total,
            order,
          );
          fixed += 1;
          continue;
        }

        if (TERMINAL_WECHAT_PAYMENT_STATES.has(tradeState)) {
          const safeToClose = await this.markCreatedPaymentFailed(
            payment.id,
            tradeState,
            wechatResult,
          );
          if (safeToClose) {
            closable += 1;
          } else {
            await this.delayAutoClose(order.id, `local_payment_state_changed_after_${tradeState}`);
            delayed += 1;
          }
          continue;
        }

        if (tradeState === 'NOTPAY') {
          const outcome = await this.closeRemoteNotPayOrder(order, payment.id, wechatResult);
          if (outcome === 'fixed') fixed += 1;
          else if (outcome === 'closable') closable += 1;
          else {
            delayed += 1;
            if (outcome === 'failed') failed += 1;
          }
          continue;
        }

        await this.delayAutoClose(order.id, `trade_state=${tradeState || 'unknown'}`);
        delayed += 1;
      } catch (error) {
        failed += 1;
        await this.delayAutoClose(order.id, `query_error=${(error as Error).message}`);
        delayed += 1;
      }
    }

    return { total: timeoutOrders.length, fixed, delayed, closable, failed };
  }

  private async closeRemoteNotPayOrder(
    order: any,
    paymentId: bigint,
    initialWechatResult: any,
  ): Promise<'fixed' | 'closable' | 'pending' | 'failed'> {
    const closeFn = (this.timeoutClosePaymentService as any).closeWechatOrderForCancellation;
    if (typeof closeFn !== 'function') {
      await this.delayAutoClose(order.id, 'wechat_close_capability_unavailable');
      return 'failed';
    }

    try {
      await closeFn.call(this.timeoutClosePaymentService, order.orderNo);
      const safeToClose = await this.markCreatedPaymentFailed(
        paymentId,
        'CLOSED_BY_MERCHANT',
        initialWechatResult,
      );
      if (safeToClose) return 'closable';

      await this.delayAutoClose(order.id, 'local_payment_state_changed_after_wechat_close');
      return 'pending';
    } catch (closeError) {
      // WeChat may reject close because payment won the race. Re-query before deciding anything
      // locally; only a fresh remote terminal fact can make this order safe to close.
      try {
        const refreshed = await this.timeoutClosePaymentService.queryWechatOrder(order.orderNo);
        const tradeState = refreshed?.trade_state;
        if (tradeState === 'SUCCESS') {
          await this.timeoutClosePaymentService.processPaymentSuccess(
            paymentId,
            order.id,
            refreshed.transaction_id,
            refreshed.amount?.total,
            order,
          );
          return 'fixed';
        }
        if (TERMINAL_WECHAT_PAYMENT_STATES.has(tradeState)) {
          const safeToClose = await this.markCreatedPaymentFailed(paymentId, tradeState, refreshed);
          if (safeToClose) return 'closable';
        }

        await this.delayAutoClose(
          order.id,
          `wechat_close_failed_then_${tradeState || 'unknown'}:${(closeError as Error).message}`,
        );
        return 'failed';
      } catch (queryError) {
        await this.delayAutoClose(
          order.id,
          `wechat_close_and_requery_failed:${(closeError as Error).message};${(queryError as Error).message}`,
        );
        return 'failed';
      }
    }
  }

  private async markCreatedPaymentFailed(
    paymentId: bigint,
    terminalState: string,
    wechatResult: any,
  ): Promise<boolean> {
    const claimed = await this.timeoutClosePrisma.orderPayment.updateMany({
      where: { id: paymentId, status: PAYMENT_STATUS.CREATED },
      data: {
        status: PAYMENT_STATUS.FAILED,
        rawResponse: {
          detector: 'timeout-order-close-confirmation',
          terminalState,
          wechat: wechatResult,
          checkedAt: new Date().toISOString(),
        },
      },
    });
    if (claimed.count === 1) return true;

    const current = await this.timeoutClosePrisma.orderPayment.findUnique({
      where: { id: paymentId },
      select: { status: true },
    });
    return current?.status === PAYMENT_STATUS.FAILED;
  }

  private async delayAutoClose(orderId: bigint, reason: string) {
    const nextCloseAt = new Date(Date.now() + this.closeDelayMs);
    await this.timeoutClosePrisma.order.updateMany({
      where: { id: orderId, status: OrderStatus.pending_payment },
      data: { autoCloseAt: nextCloseAt },
    });
    this.timeoutCloseLogger.warn(
      `订单${orderId.toString()}关单确认未收敛，延迟自动关闭：${reason}`,
    );
  }
}
