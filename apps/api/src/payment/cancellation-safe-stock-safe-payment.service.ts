import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';
import * as fs from 'fs';
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
import { StockSafeRecoverableProductionPaymentService } from './stock-safe-recoverable-production-payment.service';

const PAYMENT_CANCEL_LOCK_TTL_SECONDS = 90;

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
        status: REFUND_STATUS.CLOSED,
        wechatStatus,
        recoveredFrom: REFUND_STATUS.ABNORMAL,
      };
    }

    if (wechatStatus !== WECHAT_REFUND_STATUS.SUCCESS) {
      // Keep ABNORMAL frozen but refresh updatedAt/rawResponse through updateMany so the
      // scheduler's oldest-first scan rotates long-lived abnormal refunds fairly.
      await this.cancellationPrisma.orderRefund.updateMany({
        where: { id: refund.id, status: REFUND_STATUS.ABNORMAL },
        data: {
          refundId: wechatResult?.refund_id || refund.refundId,
          rawResponse: wechatResult,
        },
      });
      return {
        synced: false,
        status: REFUND_STATUS.ABNORMAL,
        wechatStatus,
        message: '微信退款仍未形成可自动收敛的终态',
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
          status: REFUND_STATUS.SUCCESS,
          wechatStatus,
          recoveredFrom: REFUND_STATUS.ABNORMAL,
          sideEffectsPending: true,
          message: `退款核心已同步成功，外围副作用等待自动补偿：${(error as Error).message}`,
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
    const key = `order:payment-cancel:${orderId}`;
    const token = `${process.pid}-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    const acquired = await this.cancellationRedis.setNX(
      key,
      token,
      PAYMENT_CANCEL_LOCK_TTL_SECONDS,
    );
    if (!acquired) {
      throw new BadRequestException('订单支付或取消状态处理中，请稍后重试');
    }

    try {
      return await action();
    } finally {
      await this.cancellationRedis.releaseLockWithLua(key, token);
    }
  }
}
