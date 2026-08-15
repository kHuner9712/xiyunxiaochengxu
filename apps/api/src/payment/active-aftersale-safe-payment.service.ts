import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AftersaleStatus, OrderStatus } from '@prisma/client';
import { BenefitPackageService } from '../benefit-package/benefit-package.service';
import { BusinessEventService } from '../common/business-event.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { FlashSaleService } from '../flash-sale/flash-sale.service';
import { GroupBuyService } from '../group-buy/group-buy.service';
import { MerchantSettlementService } from '../merchant-settlement/merchant-settlement.service';
import { OrderService } from '../order/order.service';
import { ShareService } from '../share/share.service';
import { ConfirmedMissingRefundRetryPaymentService } from './confirmed-missing-refund-retry-payment.service';

const ACTIVE_AFTERSALE_STATUSES: AftersaleStatus[] = [
  AftersaleStatus.pending_review,
  AftersaleStatus.approved,
  AftersaleStatus.returned,
  AftersaleStatus.pending_refund,
];
const ORDER_REFUND_LOCK_TTL_SECONDS = 300;

@Injectable()
export class ActiveAftersaleSafePaymentService extends ConfirmedMissingRefundRetryPaymentService {
  constructor(
    private readonly activeAftersalePrisma: PrismaService,
    configService: ConfigService,
    businessEvent: BusinessEventService,
    orderService: OrderService,
    shareService: ShareService,
    benefitPackageService: BenefitPackageService,
    merchantSettlementService: MerchantSettlementService,
    @Inject(GroupBuyService) groupBuyService: GroupBuyService,
    flashSaleService: FlashSaleService,
    private readonly refundSerialRedis: RedisService,
  ) {
    super(
      activeAftersalePrisma,
      configService,
      businessEvent,
      orderService,
      shareService,
      benefitPackageService,
      merchantSettlementService,
      groupBuyService,
      flashSaleService,
      refundSerialRedis,
    );
  }

  override async createRefund(params: {
    orderId: string;
    aftersaleId?: string;
    refundAmount: number;
    reason?: string;
  }) {
    // PaymentService performs the aggregate refund-cap check before creating the durable
    // INITIATING row. Without an order-scoped lock, two different aftersales can both observe the
    // same old aggregate and each submit a WeChat refund. Keep the lock across the aggregate read,
    // durable intent creation and remote submission so the next request necessarily observes the
    // first refund row in the cap calculation.
    return this.withOrderRefundLock(params.orderId, () => super.createRefund(params));
  }

  override async processWechatRefundSuccess(refund: any, refundId: string, wechatData: any) {
    try {
      return await super.processWechatRefundSuccess(refund, refundId, wechatData);
    } finally {
      // The legacy refund transaction restores the order to delivered/completed when it sees no
      // *other* active aftersale in its transaction snapshot. A new aftersale on another item can
      // commit concurrently and be invisible to that snapshot. Re-assert the aggregate order state
      // after the refund transaction: whichever operation commits last now leaves the correct final
      // state (`aftersale` whenever an active aftersale exists).
      await this.reassertActiveAftersaleOrderState(refund?.orderId);
    }
  }

  override async reconcileRefundSuccessSideEffects(limit = 200) {
    const inherited = await super.reconcileRefundSuccessSideEffects(limit);
    const activeAftersaleOrders = await this.reconcileActiveAftersaleOrderStates(limit);
    return { ...inherited, activeAftersaleOrders };
  }

  private async withOrderRefundLock<T>(rawOrderId: string, action: () => Promise<T>): Promise<T> {
    const lockKey = `payment:refund-order:${rawOrderId}`;
    const token = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const acquired = await this.refundSerialRedis.setNX(
      lockKey,
      token,
      ORDER_REFUND_LOCK_TTL_SECONDS,
    );
    if (!acquired) {
      throw new BadRequestException('该订单退款正在处理中，请稍后重试');
    }

    const heartbeat = setInterval(() => {
      void this.refundSerialRedis
        .extendLockWithLua(lockKey, token, ORDER_REFUND_LOCK_TTL_SECONDS)
        .catch(() => undefined);
    }, Math.floor((ORDER_REFUND_LOCK_TTL_SECONDS * 1000) / 3));
    heartbeat.unref?.();

    try {
      return await action();
    } finally {
      clearInterval(heartbeat);
      await this.refundSerialRedis
        .releaseLockWithLua(lockKey, token)
        .catch(() => undefined);
    }
  }

  private async reassertActiveAftersaleOrderState(rawOrderId: unknown) {
    if (rawOrderId === undefined || rawOrderId === null) return;
    let orderId: bigint;
    try {
      orderId = BigInt(rawOrderId as any);
    } catch {
      return;
    }

    const active = await this.activeAftersalePrisma.aftersaleOrder.findFirst({
      where: {
        orderId,
        status: { in: ACTIVE_AFTERSALE_STATUSES },
      },
      select: { id: true },
    });
    if (!active) return;

    await this.activeAftersalePrisma.order.updateMany({
      where: {
        id: orderId,
        status: { in: [OrderStatus.delivered, OrderStatus.completed] },
      },
      data: { status: OrderStatus.aftersale },
    });
  }

  private async reconcileActiveAftersaleOrderStates(limit: number) {
    const take = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 1000) : 200;
    const activeAftersales = await this.activeAftersalePrisma.aftersaleOrder.findMany({
      where: {
        status: { in: ACTIVE_AFTERSALE_STATUSES },
        order: { status: { in: [OrderStatus.delivered, OrderStatus.completed] } },
      },
      select: { orderId: true },
      distinct: ['orderId'],
      take,
      orderBy: { orderId: 'asc' },
    });

    let repaired = 0;
    for (const item of activeAftersales) {
      const result = await this.activeAftersalePrisma.order.updateMany({
        where: {
          id: item.orderId,
          status: { in: [OrderStatus.delivered, OrderStatus.completed] },
        },
        data: { status: OrderStatus.aftersale },
      });
      repaired += result.count;
    }

    return { checked: activeAftersales.length, repaired };
  }
}
