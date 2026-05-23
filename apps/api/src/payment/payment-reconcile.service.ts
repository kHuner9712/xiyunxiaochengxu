import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { PaymentService } from './payment.service';
import { PAYMENT_STATUS, REFUND_STATUS, WECHAT_REFUND_STATUS } from '../common/constants';
import { BusinessEventService } from '../common/business-event.service';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class PaymentReconcileService {
  private readonly logger = new Logger(PaymentReconcileService.name);

  constructor(
    private prisma: PrismaService,
    private paymentService: PaymentService,
    private businessEvent: BusinessEventService,
  ) {}

  async reconcilePendingPayments() {
    this.logger.log('支付对账开始');

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const pendingPayments = await this.prisma.orderPayment.findMany({
      where: {
        status: PAYMENT_STATUS.CREATED,
        createdAt: { lt: fiveMinutesAgo },
      },
      include: { order: true },
    });

    const halfSuccessPayments = await this.prisma.orderPayment.findMany({
      where: {
        status: PAYMENT_STATUS.SUCCESS,
        order: { status: OrderStatus.pending_payment },
      },
      include: { order: true },
    });

    let fixed = 0;
    let failed = 0;
    let skipped = 0;

    for (const payment of pendingPayments) {
      if (!payment.order || payment.order.status !== OrderStatus.pending_payment) {
        skipped++;
        continue;
      }

      try {
        const wechatResult = await this.paymentService.queryWechatOrder(payment.order.orderNo);

        if (wechatResult.trade_state === 'SUCCESS') {
          await this.paymentService.processPaymentSuccess(
            payment.id,
            payment.order.id,
            wechatResult.transaction_id,
            wechatResult.amount?.total,
            payment.order,
          );
          fixed++;
          this.logger.log(`支付对账修复: 订单${payment.order.orderNo}已从 pending_payment 转为 pending_delivery`);
          this.businessEvent.emitInfo('payment_reconcile_fix', 'reconcile', `支付对账修复: 订单${payment.order.orderNo}`, payment.order.orderNo, { paymentId: payment.id.toString(), transactionId: wechatResult.transaction_id });
        } else if (['CLOSED', 'REVOKED', 'PAYERROR'].includes(wechatResult.trade_state)) {
          this.logger.warn(`支付对账发现异常状态: 订单${payment.order.orderNo}微信状态=${wechatResult.trade_state}，本地保留等待业务超时`);
          skipped++;
        } else {
          this.logger.log(`支付对账跳过: 订单${payment.order.orderNo}微信状态=${wechatResult.trade_state}`);
          skipped++;
        }
      } catch (error) {
        this.logger.error(`支付对账查询失败: 订单${payment.order.orderNo}`, (error as Error).message);
        failed++;
      }
    }

    for (const payment of halfSuccessPayments) {
      if (!payment.order) {
        skipped++;
        continue;
      }

      try {
        this.logger.warn(`支付半成功对账: 支付${payment.id}已SUCCESS，订单${payment.order.orderNo}仍pending_payment，尝试补偿修复`);
        await this.paymentService.processPaymentSuccess(
          payment.id,
          payment.order.id,
          payment.transactionId!,
          null,
          payment.order,
        );
        fixed++;
        this.logger.log(`支付半成功对账修复: 订单${payment.order.orderNo}已从 pending_payment 修复为 pending_delivery`);
        this.businessEvent.emitInfo('payment_half_success_reconcile_fix', 'reconcile', `支付半成功对账修复: 订单${payment.order.orderNo}`, payment.order.orderNo, { paymentId: payment.id.toString() });
      } catch (error) {
        this.logger.error(`支付半成功对账修复失败: 订单${payment.order.orderNo}`, (error as Error).message);
        failed++;
      }
    }

    const total = pendingPayments.length + halfSuccessPayments.length;
    const summary = { total, fixed, failed, skipped };
    this.logger.log(`支付对账完成: ${JSON.stringify(summary)}`);
    return summary;
  }

  async reconcilePendingRefunds() {
    this.logger.log('退款对账开始');

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const pendingRefunds = await this.prisma.orderRefund.findMany({
      where: {
        status: { in: [REFUND_STATUS.INITIATING, REFUND_STATUS.PENDING, REFUND_STATUS.PROCESSING] },
        updatedAt: { lt: fiveMinutesAgo },
      },
    });

    let fixed = 0;
    let failed = 0;
    let skipped = 0;

    for (const refund of pendingRefunds) {
      try {
        const wechatResult = await this.paymentService.queryRefund(refund.outRefundNo);
        const wechatStatus = wechatResult.status;

        if (wechatStatus === WECHAT_REFUND_STATUS.SUCCESS) {
          const successAmount = wechatResult.amount?.refund;
          if (successAmount !== undefined && successAmount !== refund.refundAmount) {
            this.logger.error(`退款对账金额不匹配: ${refund.outRefundNo}期望${refund.refundAmount}分, 微信${successAmount}分`);
            skipped++;
            continue;
          }

          await this.paymentService.processWechatRefundSuccess(refund, wechatResult.refund_id || refund.refundId, wechatResult);
          fixed++;
          this.logger.log(`退款对账修复: ${refund.outRefundNo}已从 ${refund.status} 转为 success`);
          this.businessEvent.emitInfo('refund_reconcile_fix', 'reconcile', `退款对账修复: ${refund.outRefundNo}`, refund.outRefundNo, { refundId: refund.id.toString(), fromStatus: refund.status });
        } else if (wechatStatus === WECHAT_REFUND_STATUS.CLOSED || wechatStatus === WECHAT_REFUND_STATUS.ABNORMAL) {
          const localStatus = wechatStatus === WECHAT_REFUND_STATUS.CLOSED ? REFUND_STATUS.CLOSED : REFUND_STATUS.ABNORMAL;

          await this.prisma.$transaction(async (tx) => {
            await tx.orderRefund.update({
              where: { id: refund.id },
              data: { status: localStatus, rawResponse: wechatResult },
            });

            if (refund.aftersaleId) {
              await tx.aftersaleOrder.update({
                where: { id: refund.aftersaleId as bigint },
                data: {
                  status: 'pending_refund',
                  aftersaleLogs: {
                    create: {
                      operatorType: 'system',
                      action: 'reconcile_refund_failed',
                      content: `对账发现微信退款${wechatStatus}，请管理员检查后重试`,
                    },
                  },
                },
              });
            }
          });

          fixed++;
          this.logger.log(`退款对账同步终态: ${refund.outRefundNo} -> ${localStatus}`);
        } else if (wechatStatus === 'PROCESSING') {
          if (refund.status === REFUND_STATUS.INITIATING) {
            await this.prisma.orderRefund.update({
              where: { id: refund.id },
              data: { status: REFUND_STATUS.PENDING, refundId: wechatResult.refund_id || refund.refundId, rawResponse: wechatResult },
            });
            fixed++;
            this.logger.log(`退款对账修复: ${refund.outRefundNo}从 initiating 更新为 pending`);
          } else {
            skipped++;
            this.logger.log(`退款对账跳过: ${refund.outRefundNo}微信处理中，本地${refund.status}`);
          }
        } else {
          this.logger.warn(`退款对账未知微信状态: ${refund.outRefundNo} status=${wechatStatus}`);
          skipped++;
        }
      } catch (error) {
        this.logger.error(`退款对账查询失败: ${refund.outRefundNo}`, (error as Error).message);
        failed++;
      }
    }

    const summary = { total: pendingRefunds.length, fixed, failed, skipped };
    this.logger.log(`退款对账完成: ${JSON.stringify(summary)}`);
    return summary;
  }
}
