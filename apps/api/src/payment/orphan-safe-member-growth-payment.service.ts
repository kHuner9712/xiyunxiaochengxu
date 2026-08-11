import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { BenefitPackageService } from '../benefit-package/benefit-package.service';
import { BusinessEventService } from '../common/business-event.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { FlashSaleService } from '../flash-sale/flash-sale.service';
import { GroupBuyService } from '../group-buy/group-buy.service';
import { MerchantSettlementService } from '../merchant-settlement/merchant-settlement.service';
import { OrderService } from '../order/order.service';
import { ShareService } from '../share/share.service';
import { MemberGrowthConservingPaymentService } from './member-growth-conserving-payment.service';

@Injectable()
export class OrphanSafeMemberGrowthPaymentService extends MemberGrowthConservingPaymentService {
  private readonly orphanLogger = new Logger(OrphanSafeMemberGrowthPaymentService.name);

  constructor(
    private readonly orphanPrisma: PrismaService,
    private readonly orphanConfig: ConfigService,
    businessEvent: BusinessEventService,
    orderService: OrderService,
    shareService: ShareService,
    benefitPackageService: BenefitPackageService,
    merchantSettlementService: MerchantSettlementService,
    @Inject(GroupBuyService) groupBuyService: GroupBuyService,
    flashSaleService: FlashSaleService,
    redisService: RedisService,
  ) {
    super(
      orphanPrisma,
      orphanConfig,
      businessEvent,
      orderService,
      shareService,
      benefitPackageService,
      merchantSettlementService,
      groupBuyService,
      flashSaleService,
      redisService,
    );
  }

  override async handleRefundCallback(body: any, headers: any, rawBody?: Buffer | string) {
    const result = await super.handleRefundCallback(body, headers, rawBody);
    if (result?.code !== 'SUCCESS') return result;

    let outRefundNo: string;
    try {
      outRefundNo = this.decryptOutRefundNo(body?.resource);
    } catch (error) {
      this.orphanLogger.error(
        `退款回调基础处理已返回SUCCESS，但无法再次确认退款单号，拒绝向微信确认成功: ${(error as Error).message}`,
      );
      return { code: 'FAIL', message: '退款回调本地确认失败，请重试' };
    }

    const localRefund = await this.orphanPrisma.orderRefund.findFirst({
      where: { outRefundNo },
      select: { id: true, status: true },
    });
    if (!localRefund) {
      this.orphanLogger.error(
        `收到微信退款回调但本地退款记录不存在，保留失败应答等待重试: outRefundNo=${outRefundNo}`,
      );
      return { code: 'FAIL', message: '本地退款记录不存在，请重试' };
    }

    return result;
  }

  private decryptOutRefundNo(resource: any): string {
    if (!resource?.ciphertext || !resource?.nonce) {
      throw new Error('退款回调缺少加密资源');
    }
    const apiV3Key = this.orphanConfig.get<string>('WECHAT_API_V3_KEY');
    if (!apiV3Key || Buffer.byteLength(apiV3Key, 'utf8') !== 32) {
      throw new Error('WECHAT_API_V3_KEY 无效');
    }

    const encrypted = Buffer.from(resource.ciphertext, 'base64');
    if (encrypted.length <= 16) throw new Error('退款回调密文长度无效');
    const ciphertext = encrypted.subarray(0, encrypted.length - 16);
    const authTag = encrypted.subarray(encrypted.length - 16);
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      Buffer.from(apiV3Key, 'utf8'),
      Buffer.from(resource.nonce, 'utf8'),
    );
    if (resource.associated_data) {
      decipher.setAAD(Buffer.from(resource.associated_data, 'utf8'));
    }
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    const data = JSON.parse(plaintext);
    const outRefundNo = typeof data?.out_refund_no === 'string' ? data.out_refund_no.trim() : '';
    if (!outRefundNo) throw new Error('退款回调缺少 out_refund_no');
    return outRefundNo;
  }
}
