import { BadRequestException, Injectable, Logger, Optional } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import * as crypto from 'crypto';
import { BenefitPackageService } from '../benefit-package/benefit-package.service';
import { BusinessEventService } from '../common/business-event.service';
import { COUPON_STATUS, PAYMENT_STATUS, REFUND_STATUS } from '../common/constants';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { FlashSaleService } from '../flash-sale/flash-sale.service';
import { GroupBuyService } from '../group-buy/group-buy.service';
import { SystemConfigService } from '../system-config/system-config.service';
import { ProductionOrderService } from './production-order.service';

const PAYMENT_CANCEL_LOCK_TTL_SECONDS = 90;

@Injectable()
export class CancellationSafeProductionOrderService extends ProductionOrderService {
  private readonly cancellationLogger = new Logger(CancellationSafeProductionOrderService.name);

  constructor(
    private readonly cancellationPrisma: PrismaService,
    businessEventService: BusinessEventService,
    benefitPackageService: BenefitPackageService,
    groupBuyService: GroupBuyService,
    flashSaleService: FlashSaleService,
    private readonly cancellationRedis: RedisService,
    @Optional() systemConfigService?: SystemConfigService,
  ) {
    super(
      cancellationPrisma,
      businessEventService,
      benefitPackageService,
      groupBuyService,
      flashSaleService,
      systemConfigService,
    );

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
      await this.assertManualCancelHasNoUnsafePayment(id);
      return super.cancel(userId, id);
    });
  }

  override async adminCancel(id: string, reason: string) {
    return this.withPaymentCancelLock(id, async () => {
      await this.assertManualCancelHasNoUnsafePayment(id);
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

          if (currentOrder.payment && currentOrder.payment.status !== PAYMENT_STATUS.FAILED) {
            return false;
          }

          const closedAt = new Date();
          const claimed = await tx.order.updateMany({
            where: { id: currentOrder.id, status: OrderStatus.pending_payment },
            data: {
              status: OrderStatus.cancelled,
              cancelledAt: closedAt,
              cancelReason: '超时未支付自动关闭',
            },
          });
          if (claimed.count === 0) return false;

          for (const item of currentOrder.orderItems) {
            const sku = await tx.productSku.findUnique({
              where: { id: item.skuId },
              select: { stock: true },
            });
            if (!sku) continue;
            await tx.productSku.update({
              where: { id: item.skuId },
              data: { stock: { increment: item.quantity } },
            });
            await (this as any).safeDecrementSkuSales(tx, item.skuId, item.quantity);
            await tx.productStockLog.create({
              data: {
                productId: item.productId,
                skuId: item.skuId,
                type: 3,
                quantity: item.quantity,
                beforeStock: sku.stock,
                afterStock: sku.stock + item.quantity,
                reason: '超时自动关闭归还库存',
              },
            });
          }

          if (currentOrder.pointsDeducted > 0) {
            const user = await tx.user.findUnique({
              where: { id: currentOrder.userId },
              select: { availablePoints: true },
            });
            if (user) {
              await tx.user.update({
                where: { id: currentOrder.userId },
                data: { availablePoints: { increment: currentOrder.pointsDeducted } },
              });
              await tx.pointsRecord.create({
                data: {
                  userId: currentOrder.userId,
                  type: 1,
                  points: currentOrder.pointsDeducted,
                  balance: user.availablePoints + currentOrder.pointsDeducted,
                  source: 'order_auto_close',
                  sourceId: currentOrder.id,
                  description: `超时自动关闭归还积分${currentOrder.pointsDeducted}`,
                },
              });
            }
          }

          if (currentOrder.couponId) {
            await tx.userCoupon.updateMany({
              where: {
                id: currentOrder.couponId,
                status: { in: [COUPON_STATUS.LOCKED, COUPON_STATUS.USED] },
              },
              data: {
                status: COUPON_STATUS.FREE,
                usedOrderId: null,
                usedAt: null,
              },
            });
          }

          const flashSaleOrder = await tx.flashSaleOrder.findFirst({
            where: {
              orderId: currentOrder.id,
              status: 'pending_payment',
              deletedAt: null,
            },
            select: { id: true, activityId: true, quantity: true },
          });
          if (flashSaleOrder) {
            const flashClaim = await tx.flashSaleOrder.updateMany({
              where: { id: flashSaleOrder.id, status: 'pending_payment' },
              data: { status: 'cancelled', cancelledAt: closedAt },
            });
            if (flashClaim.count > 0) {
              await tx.$executeRaw`
                UPDATE flash_sale_activities
                SET locked_count = GREATEST(locked_count - ${flashSaleOrder.quantity}, 0),
                    updated_at = NOW(3)
                WHERE id = ${flashSaleOrder.activityId}
              `;
            }
          }

          await tx.groupBuyMember.updateMany({
            where: {
              orderId: currentOrder.id,
              status: 'pending_payment',
              deletedAt: null,
            },
            data: { status: 'cancelled' },
          });

          await tx.orderLog.create({
            data: {
              orderId: currentOrder.id,
              operatorType: 'system',
              action: 'auto_cancel',
              content: currentOrder.payment
                ? '超时未支付，微信交易已确认关闭，系统自动取消订单及促销占用'
                : '超时未支付且未发起微信支付，系统自动取消订单及促销占用',
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

  override async autoCompleteOrders() {
    const candidates = await this.cancellationPrisma.order.findMany({
      where: {
        status: OrderStatus.delivered,
        autoCompleteAt: { lte: new Date() },
      },
      include: { orderItems: true },
    });

    let completedCount = 0;
    for (const order of candidates) {
      try {
        await (this as any).completeOrderAndReward({
          order,
          claimWhere: {
            id: order.id,
            status: OrderStatus.delivered,
            autoCompleteAt: { lte: new Date() },
          },
          orderUpdateData: { status: OrderStatus.completed, completedAt: new Date() },
          operatorType: 'system',
          action: 'auto_complete',
          logContent: '超时未确认收货，系统自动完成',
          completeReason: '自动完成',
          rewardSource: 'order_auto_complete',
          swallowClaimFailure: true,
        });
        completedCount += 1;
      } catch (error) {
        if (
          error instanceof BadRequestException &&
          error.message === '订单抢占失败'
        ) {
          continue;
        }
        this.cancellationLogger.error(
          `自动完成订单失败：orderId=${order.id}, orderNo=${order.orderNo}, error=${(error as Error).message}`,
          (error as Error).stack,
        );
      }
    }

    return { completedCount };
  }

  private async assertManualCancelHasNoUnsafePayment(orderId: string) {
    const order = await this.cancellationPrisma.order.findUnique({
      where: { id: BigInt(orderId) },
      select: { status: true },
    });
    if (!order || order.status !== OrderStatus.pending_payment) return;

    const payment = await this.cancellationPrisma.orderPayment.findFirst({
      where: { orderId: BigInt(orderId) },
      select: { id: true, status: true },
    });
    if (payment && payment.status !== PAYMENT_STATUS.FAILED) {
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
