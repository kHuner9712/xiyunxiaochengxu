import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BenefitPackageService } from '../benefit-package/benefit-package.service';
import { BusinessEventService } from '../common/business-event.service';
import { REFUND_STATUS, WECHAT_REFUND_STATUS } from '../common/constants';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { FlashSaleService } from '../flash-sale/flash-sale.service';
import { GroupBuyService } from '../group-buy/group-buy.service';
import { MerchantSettlementService } from '../merchant-settlement/merchant-settlement.service';
import { OrderService } from '../order/order.service';
import { ShareService } from '../share/share.service';
import { OrphanSafeMemberGrowthPaymentService } from './orphan-safe-member-growth-payment.service';

/**
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
      confirmedMissingPrisma,
      configService,
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
}
