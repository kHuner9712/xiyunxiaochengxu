import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BenefitPackageService } from '../benefit-package/benefit-package.service';
import { BusinessEventService } from '../common/business-event.service';
import { PAYMENT_STATUS, REFUND_STATUS, WECHAT_REFUND_STATUS } from '../common/constants';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { FlashSaleService } from '../flash-sale/flash-sale.service';
import { GroupBuyService } from '../group-buy/group-buy.service';
import { MerchantSettlementService } from '../merchant-settlement/merchant-settlement.service';
import { OrderService } from '../order/order.service';
import { ShareService } from '../share/share.service';
import { OrphanSafeMemberGrowthPaymentService } from './orphan-safe-member-growth-payment.service';

const AUTO_VERIFIABLE_CANCELLED_PAID_TASK_REASONS = new Set([
  'cancelled_order_paid_callback',
  'cancelled_order_paid_historical_anomaly',
]);

/**
 * Outermost production payment provider.
 *
 * Keep payment/refund-success amount validation at this outer boundary so callback, user polling,
 * timeout reconciliation and scheduler recovery cannot have different trust rules. A remote
 * payment SUCCESS amount must match both local payment and order amounts before any paid-state
 * transition is allowed. A remote refund SUCCESS must contain both refund and total amounts and
 * both must match the durable refund/order records before any inventory/points/order side effect.
 * The only payment amount-less path accepted is the internal half-success repair where the local
 * payment fact is already SUCCESS.
 *
 * Cancelled-but-paid exposure tasks whose closure can be proven from SUCCESS refunds are also kept
 * system-owned here. The historical detector deliberately refuses to seed a second task while any
 * matching row exists, so allowing an operator to mark such a row resolved/ignored would otherwise
 * permanently remove a real customer-money exposure from automatic reconciliation. Amount-mismatch
 * tasks remain manually resolvable because their correct amount requires explicit human accounting.
 *
 * WeChat distinguishes an unknown/uncertain refund request from a refund that is confirmed not to
 * exist. The legacy recovery path intentionally blocks a locally FAILED refund until WeChat can
 * prove a terminal state, but previously treated a query 404 RESOURCE_NOT_EXISTS as another
 * ambiguous query failure. That can permanently freeze a legitimate refund after a definitive
 * rejection (for example insufficient merchant balance) because every retry is blocked forever.
 *
 * Only translate RESOURCE_NOT_EXISTS when the local refund is already FAILED. INITIATING/PENDING
 * refunds keep the original error so we never turn a potentially in-flight refund into a retryable
 * terminal state merely because of a transient or mismatched query.
 */
@Injectable()
export class ConfirmedMissingRefundRetryPaymentService extends OrphanSafeMemberGrowthPaymentService {
  private readonly confirmedMissingLogger = new Logger(ConfirmedMissingRefundRetryPaymentService.name);

  constructor(
    private readonly confirmedMissingPrisma: PrismaService,
    configService: ConfigService,
    private readonly confirmedMissingBusinessEvent: BusinessEventService,
    orderService: OrderService,
    shareService: ShareService,
    benefitPackageService: BenefitPackageService,
    merchantSettlementService: MerchantSettlementService,
    @Inject(GroupBuyService) groupBuyService: GroupBuyService,
    flashSaleService: FlashSaleService,
    redisService: RedisService,
  ) {
    super(
      confirmedMissingPrisma,
      configService,
      confirmedMissingBusinessEvent,
      orderService,
      shareService,
      benefitPackageService,
      merchantSettlementService,
      groupBuyService,
      flashSaleService,
      redisService,
    );
  }

  override async processPaymentSuccess(
    paymentId: bigint,
    orderId: bigint,
    transactionId: string,
    totalAmount: number | null | undefined,
    order: any,
  ) {
    const [paymentSnapshot, orderSnapshot] = await Promise.all([
      this.confirmedMissingPrisma.orderPayment.findUnique({
        where: { id: paymentId },
        select: { id: true, orderId: true, amount: true, status: true },
      }),
      this.confirmedMissingPrisma.order.findUnique({
        where: { id: orderId },
        select: { id: true, orderNo: true, payAmount: true },
      }),
    ]);

    if (!paymentSnapshot || !orderSnapshot) {
      return super.processPaymentSuccess(paymentId, orderId, transactionId, totalAmount, order);
    }

    const paymentAmount = paymentSnapshot.amount;
    const orderAmount = orderSnapshot.payAmount;
    const localAmountsValid =
      paymentSnapshot.orderId === orderId
      && Number.isSafeInteger(paymentAmount)
      && Number.isSafeInteger(orderAmount)
      && paymentAmount === orderAmount;

    if (!localAmountsValid) {
      this.emitPaymentAmountInvariantViolation({
        orderNo: orderSnapshot.orderNo,
        paymentId,
        transactionId,
        paymentAmount,
        orderAmount,
        remoteAmount: totalAmount,
        reason: 'local_amount_invariant_broken',
      });
      throw new BadRequestException('本地支付金额状态异常，禁止自动确认支付');
    }

    if (totalAmount === null || totalAmount === undefined) {
      if (paymentSnapshot.status !== PAYMENT_STATUS.SUCCESS) {
        this.emitPaymentAmountInvariantViolation({
          orderNo: orderSnapshot.orderNo,
          paymentId,
          transactionId,
          paymentAmount,
          orderAmount,
          remoteAmount: totalAmount,
          reason: 'remote_success_amount_missing',
        });
        throw new BadRequestException('支付成功金额缺失，禁止自动确认支付');
      }
    } else if (!Number.isSafeInteger(totalAmount) || totalAmount !== paymentAmount) {
      this.emitPaymentAmountInvariantViolation({
        orderNo: orderSnapshot.orderNo,
        paymentId,
        transactionId,
        paymentAmount,
        orderAmount,
        remoteAmount: totalAmount,
        reason: 'remote_amount_mismatch',
      });
      throw new BadRequestException('支付金额不匹配，禁止自动确认支付');
    }

    return super.processPaymentSuccess(paymentId, orderId, transactionId, totalAmount, order);
  }

  override async processWechatRefundSuccess(refund: any, refundId: string, wechatData: any) {
    const refundSnapshot = await this.confirmedMissingPrisma.orderRefund.findUnique({
      where: { id: refund.id },
      select: {
        id: true,
        orderId: true,
        outRefundNo: true,
        refundAmount: true,
        totalAmount: true,
      },
    });

    if (!refundSnapshot) {
      return super.processWechatRefundSuccess(refund, refundId, wechatData);
    }

    const orderSnapshot = await this.confirmedMissingPrisma.order.findUnique({
      where: { id: refundSnapshot.orderId },
      select: { id: true, orderNo: true, payAmount: true },
    });
    if (!orderSnapshot) {
      return super.processWechatRefundSuccess(refund, refundId, wechatData);
    }

    const remoteRefundAmount = wechatData?.amount?.refund;
    const remoteTotalAmount = wechatData?.amount?.total;
    const localAmountsValid =
      Number.isSafeInteger(refundSnapshot.refundAmount)
      && Number.isSafeInteger(refundSnapshot.totalAmount)
      && Number.isSafeInteger(orderSnapshot.payAmount)
      && refundSnapshot.totalAmount === orderSnapshot.payAmount;
    const remoteAmountsValid =
      Number.isSafeInteger(remoteRefundAmount)
      && Number.isSafeInteger(remoteTotalAmount)
      && remoteRefundAmount === refundSnapshot.refundAmount
      && remoteTotalAmount === refundSnapshot.totalAmount;

    if (!localAmountsValid || !remoteAmountsValid) {
      this.emitRefundAmountInvariantViolation({
        orderNo: orderSnapshot.orderNo,
        outRefundNo: refundSnapshot.outRefundNo,
        refundRecordId: refundSnapshot.id,
        refundId,
        localRefundAmount: refundSnapshot.refundAmount,
        localTotalAmount: refundSnapshot.totalAmount,
        orderAmount: orderSnapshot.payAmount,
        remoteRefundAmount,
        remoteTotalAmount,
        reason: !localAmountsValid ? 'local_amount_invariant_broken' : 'remote_amount_mismatch_or_missing',
      });
      throw new BadRequestException('退款金额不变量校验失败，禁止自动确认退款成功');
    }

    return super.processWechatRefundSuccess(refund, refundId, wechatData);
  }

  override async resolveCompensationTask(
    id: string,
    handledBy: string,
    resolution: string,
    status: 'resolved' | 'ignored',
  ) {
    const task = await this.confirmedMissingPrisma.paymentCompensationTask.findFirst({
      where: { id: BigInt(id) },
      select: { reason: true },
    });
    if (task && AUTO_VERIFIABLE_CANCELLED_PAID_TASK_REASONS.has(task.reason)) {
      throw new BadRequestException(
        '取消后已支付资金敞口任务不能人工关闭，必须由成功退款事实自动核销后关闭',
      );
    }
    return super.resolveCompensationTask(id, handledBy, resolution, status);
  }

  override async queryRefund(outRefundNo: string) {
    try {
      return await super.queryRefund(outRefundNo);
    } catch (error) {
      const wechatCode = (error as any)?.response?.data?.code;
      if (wechatCode !== 'RESOURCE_NOT_EXISTS') throw error;

      const localRefund = await this.confirmedMissingPrisma.orderRefund.findFirst({
        where: { outRefundNo },
        select: { status: true },
      });
      if (localRefund?.status !== REFUND_STATUS.FAILED) throw error;

      this.confirmedMissingLogger.warn(
        `微信确认退款单不存在，允许 FAILED 退款进入现有 CLOSED/重试恢复链: ${outRefundNo}`,
      );
      return {
        status: WECHAT_REFUND_STATUS.CLOSED,
        syntheticTerminalReason: 'RESOURCE_NOT_EXISTS',
      };
    }
  }

  private emitPaymentAmountInvariantViolation(params: {
    orderNo: string;
    paymentId: bigint;
    transactionId: string;
    paymentAmount: number;
    orderAmount: number | null;
    remoteAmount: number | null | undefined;
    reason: string;
  }) {
    this.confirmedMissingLogger.error(
      `支付成功金额不变量校验失败: order=${params.orderNo}, paymentId=${params.paymentId}, localPayment=${params.paymentAmount}, localOrder=${params.orderAmount}, remote=${params.remoteAmount ?? 'missing'}, reason=${params.reason}`,
    );
    this.confirmedMissingBusinessEvent.emitCritical(
      'payment_success_amount_invariant_violation',
      'payment',
      `支付成功金额不变量校验失败: ${params.orderNo}`,
      params.orderNo,
      {
        paymentId: params.paymentId.toString(),
        transactionId: params.transactionId,
        paymentAmount: params.paymentAmount,
        orderAmount: params.orderAmount,
        remoteAmount: params.remoteAmount ?? null,
        reason: params.reason,
      },
    );
  }

  private emitRefundAmountInvariantViolation(params: {
    orderNo: string;
    outRefundNo: string;
    refundRecordId: bigint;
    refundId: string;
    localRefundAmount: number;
    localTotalAmount: number;
    orderAmount: number | null;
    remoteRefundAmount: unknown;
    remoteTotalAmount: unknown;
    reason: string;
  }) {
    this.confirmedMissingLogger.error(
      `退款成功金额不变量校验失败: order=${params.orderNo}, outRefundNo=${params.outRefundNo}, localRefund=${params.localRefundAmount}, localTotal=${params.localTotalAmount}, order=${params.orderAmount}, remoteRefund=${String(params.remoteRefundAmount)}, remoteTotal=${String(params.remoteTotalAmount)}, reason=${params.reason}`,
    );
    this.confirmedMissingBusinessEvent.emitCritical(
      'refund_success_amount_invariant_violation',
      'refund',
      `退款成功金额不变量校验失败: ${params.outRefundNo}`,
      params.outRefundNo,
      {
        orderNo: params.orderNo,
        refundRecordId: params.refundRecordId.toString(),
        refundId: params.refundId,
        localRefundAmount: params.localRefundAmount,
        localTotalAmount: params.localTotalAmount,
        orderAmount: params.orderAmount,
        remoteRefundAmount: params.remoteRefundAmount ?? null,
        remoteTotalAmount: params.remoteTotalAmount ?? null,
        reason: params.reason,
      },
    );
  }
}
