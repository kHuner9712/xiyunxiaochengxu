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

/**
 * Outermost production payment provider.
 *
 * Besides the confirmed-missing refund recovery below, keep payment-success amount validation at
 * this outer boundary so callback, user polling, timeout reconciliation and close-failure recovery
 * cannot have different trust rules. A remote SUCCESS amount must match both local payment and
 * order amounts before any paid-state transition is allowed. The only amount-less path that is
 * accepted is the internal half-success repair where the local payment fact is already SUCCESS.
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

    // Preserve the underlying service's existing not-found/error semantics. The amount guard is an
    // invariant layer, not a replacement for the core payment state machine's entity validation.
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
}
