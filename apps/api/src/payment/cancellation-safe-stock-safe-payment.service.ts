import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { BenefitPackageService } from '../benefit-package/benefit-package.service';
import { BusinessEventService } from '../common/business-event.service';
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
    prisma: PrismaService,
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
      prisma,
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
    return this.withPaymentCancelLock(orderId, async () => super.createPayment(orderId, userId));
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
