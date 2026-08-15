import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { BenefitPackageService } from '../benefit-package/benefit-package.service';
import { BusinessEventService } from '../common/business-event.service';
import { PAYMENT_STATUS, REFUND_STATUS, WECHAT_REFUND_STATUS } from '../common/constants';
import { PrismaService } from '../common/prisma/prisma.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { RedisService } from '../common/redis/redis.service';
import { FlashSaleService } from '../flash-sale/flash-sale.service';
import { GroupBuyService } from '../group-buy/group-buy.service';
import { MerchantSettlementService } from '../merchant-settlement/merchant-settlement.service';
import { OrderService } from '../order/order.service';
import { ShareService } from '../share/share.service';
import { StockSafeRecoverableProductionPaymentService } from './stock-safe-recoverable-production-payment.service';

const PAYMENT_CANCEL_LOCK_TTL_SECONDS = 90;
const REFUND_USER_LOCK_TTL_SECONDS = 120;
const TERMINAL_WECHAT_PAYMENT_STATES = new Set(['CLOSED', 'REVOKED', 'PAYERROR']);

export interface GroupBuyFailureRefundResult {
  status: string;
  refundId?: string;
  refundNo?: string;
  outRefundNo?: string;
}

@Injectable()
export class CancellationSafeStockSafePaymentService extends StockSafeRecoverableProductionPaymentService {
  private readonly cancellationPrivateKey: string | null;

  constructor(
    private readonly cancellationPrisma: PrismaService,
    private readonly cancellationConfig: ConfigService,
    businessEvent: BusinessEventService,
    orderService: OrderService,
    shareService: ShareService,
    benefitPackageService: BenefitPackageService,
    merchantSettlementService: MerchantSettlementService,
    groupBuyService: GroupBuyService,
    flashSaleService: FlashSaleService,
    private readonly cancellationRedis: RedisService,
  ) {
    super(
      cancellationPrisma,
      cancellationConfig,
      businessEvent,
      orderService,
      shareService,
      benefitPackageService,
      merchantSettlementService,
      groupBuyService,
      flashSaleService,
    );

    const keyPath = cancellationConfig.get<string>('WECHAT_PRIVATE_KEY_PATH');
    try {
      this.cancellationPrivateKey = keyPath && fs.existsSync(keyPath)
        ? fs.readFileSync(keyPath, 'utf8')
        : null;
    } catch {
      this.cancellationPrivateKey = null;
    }
  }

  override async getPaymentStatus(orderId: string, userId: string) {
    const orderIdValue = parsePositiveBigIntId(orderId, '订单');
    return this.withPaymentCancelLock(orderId, async () => {
      const result = await super.getPaymentStatus(orderId, userId);
      const tradeState = result.tradeState;
      if (!tradeState || !TERMINAL_WECHAT_PAYMENT_STATES.has(tradeState)) {
        return result;
      }

      const terminalResult = {
        ...result,
        paymentStatus: PAYMENT_STATUS.FAILED,
        confirming: false,
        displayStatus: tradeState === 'CLOSED' ? 'closed' as const : 'failed' as const,
        canRetryPay: false,
        message: '微信支付已终止，请取消订单后重新下单',
      };

      const claimed = await this.cancellationPrisma.orderPayment.updateMany({
        where: {
          orderId: orderIdValue,
          status: PAYMENT_STATUS.CREATED,
        },
        data: { status: PAYMENT_STATUS.FAILED },
      });
      if (claimed.count === 1) {
        return terminalResult;
      }

      // A payment-success callback can race the authoritative status query. Never overwrite or
      // report that success as FAILED merely because the terminal-state compare-and-set lost.
      const currentPayment = await this.cancellationPrisma.orderPayment.findFirst({
        where: { orderId: orderIdValue },
        orderBy: { createdAt: 'desc' },
        select: { status: true },
      });
      if (currentPayment?.status === PAYMENT_STATUS.SUCCESS) {
        return super.getPaymentStatus(orderId, userId);
      }
      if (currentPayment?.status === PAYMENT_STATUS.FAILED) {
        return terminalResult;
      }

      return {
        ...result,
        confirming: true,
        canRetryPay: false,
        message: '支付状态正在收敛，请刷新后重试',
      };
    });
  }

  override async createPayment(orderId: string, userId: string) {
    return this.withPaymentCancelLock(orderId, async () => {
      const terminalPayment = await this.cancellationPrisma.orderPayment.findFirst({
        where: {
          orderId: BigInt(orderId),
          status: PAYMENT_STATUS.FAILED,
        },
        select: { id: true },
      });
      if (terminalPayment) {
        throw new BadRequestException(
          '该微信支付单已关闭，订单正在安全关单，请刷新订单状态后再操作',
        );
      }
      return super.createPayment(orderId, userId);
    });
  }

  /**
   * The standard paid-refund flow validates duplicate/cumulative refund state before it writes the
   * durable INITIATING row. Without a shared per-order claim, two concurrent requests can both pass
   * those reads, create different out_refund_no values and independently reach WeChat. Serialize
   * the complete refund-creation state machine on the same order lock used by payment creation and
   * cancellation.
   *
   * The inherited flow persists INITIATING before the remote refund request. Once the first holder
   * reaches WeChat, a later holder therefore observes durable in-flight refund state even if the
   * first request times out or the process crashes after the remote call.
   */
  override async createRefund(params: {
    orderId: string;
    aftersaleId?: string;
    refundAmount: number;
    reason?: string;
  }) {
    return this.withPaymentCancelLock(params.orderId, () => super.createRefund(params));
  }

  /**
   * Refund-success side effects read a user's current points before applying a decrement. Two
   * successful refunds on different orders can otherwise both observe the same pre-decrement
   * balance and drive availablePoints below zero. Serialize the inherited refund-success core by
   * user across all orders. This is deliberately independent from the per-order payment/cancel lock.
   *
   * If the lock is occupied we fail closed; WeChat callback/reconciliation will retry. Deleted users
   * are still eligible for monetary refund processing, so the lookup does not require an active user.
   */
  override async processWechatRefundSuccess(refund: any, refundId: string, wechatData: any) {
    const rawOrderId = refund?.orderId;
    if (rawOrderId === undefined || rawOrderId === null) {
      throw new BadRequestException('退款记录缺少订单ID，无法安全处理退款');
    }

    const order = await this.cancellationPrisma.order.findUnique({
      where: { id: BigInt(rawOrderId) },
      select: { userId: true },
    });
    if (!order) {
      throw new BadRequestException('退款对应订单不存在，无法安全处理退款');
    }

    return this.withRefundUserLock(order.userId.toString(), () =>
      super.processWechatRefundSuccess(refund, refundId, wechatData),
    );
  }

  /**
   * Production group-failure refund creation eventually calls `this.createRefund(...)`. The
   * standard refund override above is therefore the single per-order lock boundary. Acquiring the
   * same non-reentrant Redis lock here as well would self-deadlock the group-failure path. Keep this
   * wrapper lock-free and let the durable refund-intent creation acquire the shared order lock once.
   */
  override async createGroupBuyFailureRefund(
    orderId: bigint | string,
    reason = '拼团失败自动退款',
  ): Promise<GroupBuyFailureRefundResult> {
    return super.createGroupBuyFailureRefund(orderId, reason);
  }

  /**
   * ABNORMAL is not retryable, but it is observable: after an operator resolves the refund in
   * the WeChat merchant platform, the authoritative query may move to PROCESSING/CLOSED/SUCCESS.
   * Re-open only that ABNORMAL record into a state the existing refund state machine already
   * knows how to reconcile. CLOSED records remain immutable and are never re-opened here.
   */
  override async syncRefund(outRefundNo: string) {
    const refund = await this.cancellationPrisma.orderRefund.findFirst({
      where: { outRefundNo },
    });
    if (!refund || refund.status !== REFUND_STATUS.ABNORMAL) {
      return super.syncRefund(outRefundNo);
    }

    const wechatResult = await this.queryRefund(outRefundNo);
    const wechatStatus = wechatResult?.status;

    if (wechatStatus === 'PROCESSING') {
      await this.cancellationPrisma.orderRefund.updateMany({
        where: { id: refund.id, status: REFUND_STATUS.ABNORMAL },
        data: {
          status: REFUND_STATUS.PENDING,
          refundId: wechatResult.refund_id || refund.refundId,
          rawResponse: wechatResult,
        },
      });
      return {
        synced: true,
        reason: 'abnormal_recovered_processing',
        message: '微信退款异常已恢复为处理中，本地已恢复对账',
        status: REFUND_STATUS.PENDING,
        wechatStatus,
        recoveredFrom: REFUND_STATUS.ABNORMAL,
      };
    }

    if (wechatStatus === WECHAT_REFUND_STATUS.CLOSED) {
      await this.cancellationPrisma.orderRefund.updateMany({
        where: { id: refund.id, status: REFUND_STATUS.ABNORMAL },
        data: {
          status: REFUND_STATUS.CLOSED,
          refundId: wechatResult.refund_id || refund.refundId,
          rawResponse: wechatResult,
        },
      });
      return {
        synced: true,
        reason: 'abnormal_recovered_closed',
        message: '微信退款异常已确认关闭，本地已同步为 CLOSED',
        status: REFUND_STATUS.CLOSED,
        wechatStatus,
        recoveredFrom: REFUND_STATUS.ABNORMAL,
      };
    }

    if (wechatStatus !== WECHAT_REFUND_STATUS.SUCCESS) {
      await this.cancellationPrisma.orderRefund.updateMany({
        where: { id: refund.id, status: REFUND_STATUS.ABNORMAL },
        data: {
          refundId: wechatResult?.refund_id || refund.refundId,
          rawResponse: wechatResult,
        },
      });
      return {
        synced: false,
        reason: 'wechat_still_abnormal',
        message: '微信退款仍未形成可自动收敛的终态',
        status: REFUND_STATUS.ABNORMAL,
        wechatStatus,
      };
    }

    const successAmount = wechatResult.amount?.refund;
    const totalAmount = wechatResult.amount?.total;
    if (successAmount !== undefined && successAmount !== refund.refundAmount) {
      throw new BadRequestException(
        `微信退款金额与本地不一致：expected=${refund.refundAmount}, actual=${successAmount}`,
      );
    }
    if (totalAmount !== undefined && totalAmount !== refund.totalAmount) {
      throw new BadRequestException(
        `微信订单总金额与本地退款记录不一致：expected=${refund.totalAmount}, actual=${totalAmount}`,
      );
    }

    const reopened = await this.cancellationPrisma.orderRefund.updateMany({
      where: { id: refund.id, status: REFUND_STATUS.ABNORMAL },
      data: {
        status: REFUND_STATUS.PENDING,
        refundId: wechatResult.refund_id || refund.refundId,
        rawResponse: wechatResult,
      },
    });
    if (reopened.count === 0) {
      return super.syncRefund(outRefundNo);
    }

    try {
      await this.processWechatRefundSuccess(
        refund,
        wechatResult.refund_id || refund.refundId || '',
        wechatResult,
      );
      return {
        synced: true,
        reason: 'abnormal_recovered_success',
        message: '微信退款异常已确认成功，本地退款及副作用已收敛',
        status: REFUND_STATUS.SUCCESS,
        wechatStatus,
        recoveredFrom: REFUND_STATUS.ABNORMAL,
      };
    } catch (error) {
      const current = await this.cancellationPrisma.orderRefund.findUnique({
        where: { id: refund.id },
        select: { status: true },
      });
      if (current?.status === REFUND_STATUS.SUCCESS) {
        return {
          synced: true,
          reason: 'abnormal_core_success_side_effects_pending',
          message: `退款核心已同步成功，外围副作用等待自动补偿：${(error as Error).message}`,
          status: REFUND_STATUS.SUCCESS,
          wechatStatus,
          recoveredFrom: REFUND_STATUS.ABNORMAL,
          sideEffectsPending: true,
        };
      }
      throw error;
    }
  }

  async closeWechatOrderForCancellation(outTradeNo: string): Promise<void> {
    const mchId = this.cancellationConfig.get<string>('WECHAT_MCH_ID');
    const serialNo = this.cancellationConfig.get<string>('WECHAT_MCH_SERIAL_NO');
    if (!mchId || !serialNo || !this.cancellationPrivateKey) {
      throw new BadRequestException('微信支付关单能力未完整配置，不能安全关闭本地订单');
    }

    const encodedTradeNo = encodeURIComponent(outTradeNo);
    const requestPath = `/v3/pay/transactions/out-trade-no/${encodedTradeNo}/close`;
    const body = JSON.stringify({ mchid: mchId });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = crypto.randomBytes(16).toString('hex');
    const message = `POST\n${requestPath}\n${timestamp}\n${nonceStr}\n${body}\n`;
    const signer = crypto.createSign('SHA256');
    signer.update(message);
    signer.end();
    const signature = signer.sign(this.cancellationPrivateKey, 'base64');

    await axios.post(`https://api.mch.weixin.qq.com${requestPath}`, JSON.parse(body), {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `WECHATPAY2-SHA256-RSA2048 mchid="${mchId}",nonce_str="${nonceStr}",timestamp="${timestamp}",serial_no="${serialNo}",signature="${signature}"`,
      },
    });
  }

  private async withPaymentCancelLock<T>(orderId: string, action: () => Promise<T>): Promise<T> {
    return this.withRenewingRedisLock(
      `order:payment-cancel:${orderId}`,
      PAYMENT_CANCEL_LOCK_TTL_SECONDS,
      '订单支付、取消或退款状态处理中，请稍后重试',
      action,
    );
  }

  private async withRefundUserLock<T>(userId: string, action: () => Promise<T>): Promise<T> {
    return this.withRenewingRedisLock(
      `user:refund-success:${userId}`,
      REFUND_USER_LOCK_TTL_SECONDS,
      '该用户退款状态正在处理中，请稍后重试',
      action,
    );
  }

  private async withRenewingRedisLock<T>(
    key: string,
    ttlSeconds: number,
    busyMessage: string,
    action: () => Promise<T>,
  ): Promise<T> {
    const token = `${process.pid}-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    const acquired = await this.cancellationRedis.setNX(key, token, ttlSeconds);
    if (!acquired) {
      throw new BadRequestException(busyMessage);
    }

    // Remote WeChat calls and refund-success side effects can outlive a fixed Redis TTL during a
    // network stall or database incident. Renew the exact token periodically so another worker
    // cannot enter the same critical section merely because the original lease elapsed.
    const heartbeat = setInterval(() => {
      void this.cancellationRedis
        .extendLockWithLua(key, token, ttlSeconds)
        .catch(() => undefined);
    }, Math.max(1000, Math.floor((ttlSeconds * 1000) / 3)));
    heartbeat.unref?.();

    try {
      return await action();
    } finally {
      clearInterval(heartbeat);
      // The business operation has already committed or failed by this point. A transient Redis
      // release error must not turn a successful payment/refund operation into an API failure; the
      // tokenized lease will expire naturally if explicit release is unavailable.
      await this.cancellationRedis.releaseLockWithLua(key, token).catch(() => undefined);
    }
  }
}
