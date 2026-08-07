import { BadRequestException, Injectable } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import * as crypto from 'crypto';
import { BenefitPackageService } from '../benefit-package/benefit-package.service';
import { BusinessEventService } from '../common/business-event.service';
import { PAYMENT_STATUS, REFUND_STATUS } from '../common/constants';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { FlashSaleService } from '../flash-sale/flash-sale.service';
import { GroupBuyService } from '../group-buy/group-buy.service';
import { ProductionOrderService } from './production-order.service';

const PAYMENT_CANCEL_LOCK_TTL_SECONDS = 90;

@Injectable()
export class CancellationSafeProductionOrderService extends ProductionOrderService {
  constructor(
    private readonly cancellationPrisma: PrismaService,
    businessEventService: BusinessEventService,
    benefitPackageService: BenefitPackageService,
    groupBuyService: GroupBuyService,
    flashSaleService: FlashSaleService,
    private readonly cancellationRedis: RedisService,
  ) {
    super(
      cancellationPrisma,
      businessEventService,
      benefitPackageService,
      groupBuyService,
      flashSaleService,
    );

    // OrderService keeps the completion reward helper private, but the runtime method is
    // dispatched through `this`. Wrap it at the outermost production provider so the original
    // completion transaction remains intact while reward points use net paid revenue after all
    // refunds that were already successful before the order completes.
    const rewardCompletedOrder = (this as any).rewardCompletedOrder.bind(this);
    (this as any).rewardCompletedOrder = async (
      tx: any,
      order: any,
      rewardSource: string,
    ) => {
      const refundSummary = await tx.orderRefund.aggregate({
        where: {
          orderId: order.id,
          status: REFUND_STATUS.SUCCESS,
        },
        _sum: { refundAmount: true },
      });
      const successfulRefundAmount = refundSummary?._sum?.refundAmount ?? 0;
      const netPayAmount = Math.max((order.payAmount ?? 0) - successfulRefundAmount, 0);
      return rewardCompletedOrder(
        tx,
        { ...order, payAmount: netPayAmount },
        rewardSource,
      );
    };
  }

  override async cancel(userId: string, id: string) {
    return this.withPaymentCancelLock(id, async () => {
      await this.assertManualCancelHasNoPayment(id);
      return super.cancel(userId, id);
    });
  }

  override async adminCancel(id: string, reason: string) {
    return this.withPaymentCancelLock(id, async () => {
      await this.assertManualCancelHasNoPayment(id);
      return super.adminCancel(id, reason);
    });
  }

  override async closeTimeoutOrders() {
    const timeoutOrders = await this.cancellationPrisma.order.findMany({
      where: {
        status: OrderStatus.pending_payment,
        autoCloseAt: { lte: new Date() },
      },
      select: { id: true },
      take: 100,
    });

    let closedCount = 0;
    for (const candidate of timeoutOrders) {
      const orderId = candidate.id.toString();
      const key = this.paymentCancelLockKey(orderId);
      const token = this.lockToken();
      const acquired = await this.cancellationRedis.setNX(
        key,
        token,
        PAYMENT_CANCEL_LOCK_TTL_SECONDS,
      );
      if (!acquired) continue;

      try {
        const closed = await this.cancellationPrisma.$transaction(async (tx) => {
          const currentOrder = await tx.order.findUnique({
            where: { id: candidate.id },
            include: { orderItems: true, payment: true },
          });
          if (
            !currentOrder ||
            currentOrder.status !== OrderStatus.pending_payment ||
            !currentOrder.autoCloseAt ||
            currentOrder.autoCloseAt.getTime() > Date.now()
          ) {
            return false;
          }

          // A CREATED/SUCCESS payment must never be locally cancelled. Payment reconciliation
          // first closes the remote WeChat transaction and only then marks it FAILED.
          if (currentOrder.payment && currentOrder.payment.status !== PAYMENT_STATUS.FAILED) {
            return false;
          }

          const claimed = await tx.order.updateMany({
            where: { id: currentOrder.id, status: OrderStatus.pending_payment },
            data: { status: OrderStatus.cancelled, cancelledAt: new Date() },
          });
          if (claimed.count === 0) return false;

          for (const item of currentOrder.orderItems) {
            await tx.productSku.update({
              where: { id: item.skuId },
              data: { stock: { increment: item.quantity } },
            });
            await (this as any).safeDecrementSkuSales(tx, item.skuId, item.quantity);
          }

          await (this as any).restoreUserPoints(tx, currentOrder);
          await (this as any).releaseCouponAfterCancel(tx, currentOrder);
          await tx.orderLog.create({
            data: {
              orderId: currentOrder.id,
              operatorType: 'system',
              action: 'auto_cancel',
              content: currentOrder.payment
                ? '超时未支付，微信交易已确认关闭，系统自动取消订单'
                : '超时未支付且未发起微信支付，系统自动取消订单',
            },
          });
          return true;
        });
        if (closed) closedCount += 1;
      } finally {
        await this.cancellationRedis.releaseLockWithLua(key, token);
      }
    }

    return { closedCount };
  }

  private async assertManualCancelHasNoPayment(orderId: string) {
    const order = await this.cancellationPrisma.order.findUnique({
      where: { id: BigInt(orderId) },
      select: { status: true },
    });
    if (!order || order.status !== OrderStatus.pending_payment) return;

    const payment = await this.cancellationPrisma.orderPayment.findFirst({
      where: { orderId: BigInt(orderId) },
      select: { id: true, status: true },
    });
    if (payment) {
      throw new BadRequestException(
        '该订单已发起微信支付，为避免扣款与取消并发，请等待支付结果确认；未支付订单会在微信关单确认后自动关闭',
      );
    }
  }

  private async withPaymentCancelLock<T>(orderId: string, action: () => Promise<T>): Promise<T> {
    const key = this.paymentCancelLockKey(orderId);
    const token = this.lockToken();
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

  private paymentCancelLockKey(orderId: string) {
    return `order:payment-cancel:${orderId}`;
  }

  private lockToken() {
    return `${process.pid}-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
  }
}
