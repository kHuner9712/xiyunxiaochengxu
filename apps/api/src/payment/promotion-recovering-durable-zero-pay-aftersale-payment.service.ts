import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus } from '@prisma/client';
import { BenefitPackageService } from '../benefit-package/benefit-package.service';
import { BusinessEventService } from '../common/business-event.service';
import { PAYMENT_STATUS } from '../common/constants';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { FlashSaleService } from '../flash-sale/flash-sale.service';
import { GroupBuyService } from '../group-buy/group-buy.service';
import { MerchantSettlementService } from '../merchant-settlement/merchant-settlement.service';
import { OrderService } from '../order/order.service';
import { ShareService } from '../share/share.service';
import { DurableZeroPayAftersalePaymentService } from './durable-zero-pay-aftersale-payment.service';

interface GroupBuyRecoveryCandidate {
  orderId: bigint;
  orderNo: string;
  memberStatus: string;
  groupStatus: string;
}

interface GroupBuyPaymentOutcome {
  isGroupBuy?: boolean;
  state?: 'waiting' | 'success' | 'refund_required' | 'already_refunded';
  releasedOrderIds?: string[];
  reason?: string;
}

/**
 * Outermost payment runtime provider.
 *
 * A successful WeChat payment is committed before group-buy settlement runs. If that second step
 * hits a transient database/runtime failure, the order remains durably paid while the group member
 * can still be pending_payment. WeChat callback retries often repair this, but internal payment
 * polling/reconciliation can also be the path that first records SUCCESS, so callback retry alone
 * is not a durable recovery mechanism.
 *
 * The periodic paid-side-effect reconciliation already runs every two minutes. Reuse that cadence,
 * but only replay anomalous/terminal group rows. Healthy `paid + forming + member paid` rows are
 * deliberately excluded so normal waiting groups are not touched on every scheduler pass.
 */
@Injectable()
export class PromotionRecoveringDurableZeroPayAftersalePaymentService extends DurableZeroPayAftersalePaymentService {
  private readonly promotionRecoveryLogger = new Logger(
    PromotionRecoveringDurableZeroPayAftersalePaymentService.name,
  );

  constructor(
    private readonly promotionRecoveryPrisma: PrismaService,
    configService: ConfigService,
    businessEvent: BusinessEventService,
    orderService: OrderService,
    shareService: ShareService,
    benefitPackageService: BenefitPackageService,
    merchantSettlementService: MerchantSettlementService,
    @Inject(GroupBuyService)
    private readonly promotionRecoveryGroupBuyService: GroupBuyService,
    flashSaleService: FlashSaleService,
    redisService: RedisService,
  ) {
    super(
      promotionRecoveryPrisma,
      configService,
      businessEvent,
      orderService,
      shareService,
      benefitPackageService,
      merchantSettlementService,
      promotionRecoveryGroupBuyService,
      flashSaleService,
      redisService,
    );
  }

  override async reconcilePaidOrderSideEffects(limit = 200) {
    // Recover the group state first. If this pass makes a group successful, its released orders
    // become pending_delivery/pending_pickup and are then immediately eligible for the inherited
    // reward/benefit reconciliation in the same scheduler execution.
    const groupBuyRecovery = await this.reconcileGroupBuyPaymentStateGaps(limit);
    const inherited = await super.reconcilePaidOrderSideEffects(limit);
    return { ...inherited, groupBuyRecovery };
  }

  async reconcileGroupBuyPaymentStateGaps(limit = 200) {
    const safeLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 1000) : 200;
    const candidates = await this.promotionRecoveryPrisma.$queryRaw<GroupBuyRecoveryCandidate[]>`
      SELECT
        o.id AS orderId,
        o.order_no AS orderNo,
        gm.status AS memberStatus,
        g.status AS groupStatus
      FROM orders o
      INNER JOIN order_payments p
        ON p.order_id = o.id
       AND p.status = ${PAYMENT_STATUS.SUCCESS}
      INNER JOIN group_buy_members gm
        ON gm.order_id = o.id
       AND gm.deleted_at IS NULL
      INNER JOIN group_buy_groups g
        ON g.id = gm.group_id
       AND g.deleted_at IS NULL
      WHERE o.status = ${OrderStatus.paid}
        AND (
          gm.status <> 'paid'
          OR g.status IN ('success', 'failed', 'cancelled')
          OR (g.status = 'forming' AND g.expires_at <= NOW(3))
        )
      ORDER BY o.id ASC
      LIMIT ${safeLimit}
    `;

    let recovered = 0;
    let waiting = 0;
    let releasedOrders = 0;
    let refundRequired = 0;
    let failed = 0;

    for (const candidate of candidates) {
      try {
        const outcome = (await this.promotionRecoveryGroupBuyService.handlePaymentSuccess(
          candidate.orderId,
        )) as unknown as GroupBuyPaymentOutcome;

        if (outcome?.state === 'refund_required') {
          await this.createGroupBuyFailureRefund(
            candidate.orderId,
            outcome.reason || '拼团失败自动退款',
          );
          refundRequired += 1;
          recovered += 1;
          continue;
        }

        if (outcome?.state === 'success') {
          releasedOrders += outcome.releasedOrderIds?.length ?? 0;
          recovered += 1;
          continue;
        }

        if (outcome?.state === 'waiting') {
          // This is the expected recovery result when payment succeeded but the member transition
          // was the only missing write. The member/currentCount are now settled and the group can
          // continue waiting for other participants normally.
          waiting += 1;
          recovered += 1;
          continue;
        }

        if (outcome?.state === 'already_refunded') {
          recovered += 1;
          continue;
        }

        this.promotionRecoveryLogger.warn(
          `拼团支付状态补偿返回未知结果: orderId=${candidate.orderId}, memberStatus=${candidate.memberStatus}, groupStatus=${candidate.groupStatus}`,
        );
      } catch (error) {
        failed += 1;
        this.promotionRecoveryLogger.error(
          `拼团支付状态自动补偿失败: orderId=${candidate.orderId}, error=${(error as Error).message}`,
          (error as Error).stack,
        );
      }
    }

    return {
      total: candidates.length,
      recovered,
      waiting,
      releasedOrders,
      refundRequired,
      failed,
    };
  }
}
