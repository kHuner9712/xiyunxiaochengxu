import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BenefitPackageService } from '../benefit-package/benefit-package.service';
import { BusinessEventService } from '../common/business-event.service';
import { REFUND_STATUS } from '../common/constants';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { FlashSaleService } from '../flash-sale/flash-sale.service';
import { GroupBuyService } from '../group-buy/group-buy.service';
import { MerchantSettlementService } from '../merchant-settlement/merchant-settlement.service';
import { OrderService } from '../order/order.service';
import { ShareService } from '../share/share.service';
import { ZeroPayAftersalePaymentService } from './zero-pay-aftersale-payment.service';

const ZERO_PAY_REFUND_SIDE_EFFECT_REASON = 'zero_refund_side_effects';
const ZERO_PAY_REFUND_POINT_REASON = 'zero_refund_points_conservation';

interface ZeroPayRefundSideEffectCandidate {
  refundId: bigint;
  orderId: bigint;
  aftersaleId: bigint;
  orderNo: string;
}

interface RefundBenefitEffectCapability {
  assertRefundable(orderId: bigint | string, aftersaleId?: bigint | string | null): Promise<unknown>;
  freezeForRefund(orderId: bigint | string, aftersaleId?: bigint | string | null): Promise<unknown>;
  restoreAfterRefundClosed(orderId: bigint | string, aftersaleId?: bigint | string | null): Promise<unknown>;
  revokeAfterRefundSuccess(orderId: bigint | string, aftersaleId?: bigint | string | null): Promise<unknown>;
}

interface RefundGroupBuyEffectCapability {
  handleRefundSuccess(orderId: bigint | string): Promise<unknown>;
}

@Injectable()
export class DurableZeroPayAftersalePaymentService extends ZeroPayAftersalePaymentService {
  private readonly durableZeroPayLogger = new Logger(DurableZeroPayAftersalePaymentService.name);

  constructor(
    private readonly durableZeroPayPrisma: PrismaService,
    configService: ConfigService,
    businessEvent: BusinessEventService,
    orderService: OrderService,
    shareService: ShareService,
    @Inject(BenefitPackageService)
    private readonly durableZeroPayBenefitPackageService: BenefitPackageService & RefundBenefitEffectCapability,
    merchantSettlementService: MerchantSettlementService,
    @Inject(GroupBuyService)
    private readonly durableZeroPayGroupBuyService: GroupBuyService & RefundGroupBuyEffectCapability,
    flashSaleService: FlashSaleService,
    redisService: RedisService,
  ) {
    super(
      durableZeroPayPrisma,
      configService,
      businessEvent,
      orderService,
      shareService,
      durableZeroPayBenefitPackageService,
      merchantSettlementService,
      durableZeroPayGroupBuyService,
      flashSaleService,
      redisService,
    );
  }

  override async reconcileRefundSuccessSideEffects(limit = 200) {
    const inherited = await super.reconcileRefundSuccessSideEffects(limit);
    const zeroPaySideEffects = await this.reconcileZeroPayRefundSideEffects(limit);
    return { ...inherited, zeroPaySideEffects };
  }

  override async resolveCompensationTask(
    id: string,
    handledBy: string,
    resolution: string,
    status: 'resolved' | 'ignored',
  ) {
    const taskId = parsePositiveBigIntId(id, '补偿任务');
    const task = await this.durableZeroPayPrisma.paymentCompensationTask.findFirst({
      where: { id: taskId },
      select: { reason: true },
    });
    if (task?.reason === ZERO_PAY_REFUND_SIDE_EFFECT_REASON) {
      throw new BadRequestException('0元退款权益/拼团一致性补偿任务不能人工关闭，必须由自动对账实际执行成功后关闭');
    }
    if (task?.reason === ZERO_PAY_REFUND_POINT_REASON) {
      throw new BadRequestException('0元退款积分守恒补偿任务不能人工关闭，必须由自动对账实际收敛后关闭');
    }
    return super.resolveCompensationTask(id, handledBy, resolution, status);
  }

  private async reconcileZeroPayRefundSideEffects(limit = 200) {
    const candidates = await this.durableZeroPayPrisma.$queryRaw<ZeroPayRefundSideEffectCandidate[]>`
      SELECT
        r.id AS refundId,
        r.order_id AS orderId,
        r.aftersale_id AS aftersaleId,
        o.order_no AS orderNo
      FROM order_refunds r
      INNER JOIN orders o ON o.id = r.order_id
      LEFT JOIN payment_compensation_tasks task
        ON task.order_no = o.order_no
       AND task.reason = ${ZERO_PAY_REFUND_SIDE_EFFECT_REASON}
       AND task.transaction_id = CONCAT('zero-refund-effects:', r.id)
      WHERE r.status = ${REFUND_STATUS.SUCCESS}
        AND r.aftersale_id IS NOT NULL
        AND r.refund_amount = 0
        AND r.total_amount = 0
        AND r.refund_id LIKE 'ZERO-%'
        AND (task.id IS NULL OR task.status = 'pending')
      ORDER BY r.updated_at ASC, r.id ASC
      LIMIT ${limit}
    `;

    let resolved = 0;
    let failed = 0;
    for (const candidate of candidates) {
      const transactionId = `zero-refund-effects:${candidate.refundId}`;
      let task = await this.durableZeroPayPrisma.paymentCompensationTask.findFirst({
        where: {
          orderNo: candidate.orderNo,
          reason: ZERO_PAY_REFUND_SIDE_EFFECT_REASON,
          transactionId,
        },
      });

      if (!task) {
        try {
          task = await this.durableZeroPayPrisma.paymentCompensationTask.create({
            data: {
              orderNo: candidate.orderNo,
              transactionId,
              amount: null,
              reason: ZERO_PAY_REFUND_SIDE_EFFECT_REASON,
              status: 'pending',
              callbackPayload: {
                refundId: candidate.refundId.toString(),
                orderId: candidate.orderId.toString(),
                aftersaleId: candidate.aftersaleId.toString(),
              },
              resolution: '等待自动补偿0元退款后的权益撤销与拼团副作用',
            },
          });
        } catch (error: any) {
          if (error?.code !== 'P2002') throw error;
          task = await this.durableZeroPayPrisma.paymentCompensationTask.findFirst({
            where: {
              orderNo: candidate.orderNo,
              reason: ZERO_PAY_REFUND_SIDE_EFFECT_REASON,
              transactionId,
            },
          });
        }
      }
      if (!task || task.status === 'resolved') continue;

      try {
        await this.durableZeroPayBenefitPackageService.revokeAfterRefundSuccess(
          candidate.orderId,
          candidate.aftersaleId,
        );
        await this.durableZeroPayGroupBuyService.handleRefundSuccess(candidate.orderId);

        await this.durableZeroPayPrisma.paymentCompensationTask.updateMany({
          where: { id: task.id, status: 'pending' },
          data: {
            status: 'resolved',
            handledBy: 'system:zero-refund-side-effects',
            handledAt: new Date(),
            resolution: '0元退款后的权益撤销与拼团副作用已实际执行成功',
          },
        });
        resolved += 1;
      } catch (error) {
        failed += 1;
        const message = (error as Error).message;
        await this.durableZeroPayPrisma.paymentCompensationTask.updateMany({
          where: { id: task.id, status: 'pending' },
          data: {
            handledBy: null,
            handledAt: null,
            resolution: `0元退款副作用自动补偿失败，等待重试：${message}`.slice(0, 4000),
          },
        });
        this.durableZeroPayLogger.error(
          `0元退款副作用补偿失败: refundId=${candidate.refundId}, orderId=${candidate.orderId}, error=${message}`,
        );
      }
    }

    return { total: candidates.length, resolved, failed };
  }
}
