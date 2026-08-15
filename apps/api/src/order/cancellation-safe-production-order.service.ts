import { BadRequestException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
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
    private readonly cancellationGroupBuyService: GroupBuyService,
    private readonly cancellationFlashSaleService: FlashSaleService,
    private readonly cancellationRedis: RedisService,
    @Optional() systemConfigService?: SystemConfigService,
  ) {
    super(
      cancellationPrisma,
      businessEventService,
      benefitPackageService,
      cancellationGroupBuyService,
      cancellationFlashSaleService,
      systemConfigService,
    );

    // OrderService keeps this hook private, but every completion path dispatches through the
    // instance. Replace it at the production boundary so reward amount is net of successful
    // refunds and the ledger balance comes from the serialized user UPDATE, not a stale snapshot.
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
      const earnedPoints = Math.floor(netPayAmount / 100);
      if (earnedPoints <= 0) return 0;

      const existingRecord = await tx.pointsRecord.findFirst({
        where: { source: rewardSource, sourceId: order.id },
      });
      if (existingRecord) return 0;

      const updatedUser = await tx.user.update({
        where: { id: order.userId },
        data: {
          availablePoints: { increment: earnedPoints },
          totalPoints: { increment: earnedPoints },
          growthValue: { increment: earnedPoints },
        },
        select: { availablePoints: true },
      });

      await tx.pointsRecord.create({
        data: {
          userId: order.userId,
          type: 1,
          points: earnedPoints,
          balance: updatedUser.availablePoints,
          source: rewardSource,
          sourceId: order.id,
          description: `完成订单奖励${earnedPoints}积分`,
        },
      });

      return earnedPoints;
    };
  }

  override async cancel(userId: string, id: string) {
    return this.withPaymentCancelLock(id, async () => {
      await this.assertManualCancelHasNoUnsafePayment(id);
      return this.cancelPendingOrder({
        orderId: id,
        userId: BigInt(userId),
        reason: '用户主动取消',
        stockReason: '取消订单归还库存',
        operatorType: 'user',
        operatorId: BigInt(userId),
        action: 'cancel',
        logContent: '用户取消订单',
        pointsSource: 'order_cancel',
        pointsDescription: (points) => `取消订单归还积分${points}`,
        couponStatuses: [COUPON_STATUS.LOCKED, COUPON_STATUS.USED],
      });
    });
  }

  override async adminCancel(id: string, reason: string) {
    return this.withPaymentCancelLock(id, async () => {
      await this.assertManualCancelHasNoUnsafePayment(id);
      return this.cancelPendingOrder({
        orderId: id,
        reason: reason || '管理员取消',
        stockReason: '管理员取消订单归还库存',
        operatorType: 'admin',
        action: 'cancel',
        logContent: `管理员取消订单，原因：${reason || '无'}`,
        pointsSource: 'admin_cancel',
        pointsDescription: (points) => `管理员取消订单归还积分${points}`,
        couponStatuses: [COUPON_STATUS.LOCKED],
      });
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
            await this.restoreSkuStockAndSalesAuthoritative(
              tx,
              item,
              '超时自动关闭归还库存',
              3,
            );
          }

          await this.restoreDeductedPoints(
            tx,
            currentOrder.userId,
            currentOrder.pointsDeducted,
            'order_auto_close',
            currentOrder.id,
            `超时自动关闭归还积分${currentOrder.pointsDeducted}`,
          );

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
        const claimed = await this.cancellationPrisma.$transaction(async (tx) => {
          const claimResult = await tx.order.updateMany({
            where: {
              id: order.id,
              status: OrderStatus.delivered,
              autoCompleteAt: { lte: new Date() },
            },
            data: {
              status: OrderStatus.completed,
              completedAt: new Date(),
            },
          });
          if (claimResult.count === 0) return false;

          const earnedPoints = await (this as any).rewardCompletedOrder(
            tx,
            order,
            'order_auto_complete',
          );
          await tx.orderLog.create({
            data: {
              orderId: order.id,
              operatorType: 'system',
              action: 'auto_complete',
              content: `超时未确认收货，系统自动完成${earnedPoints > 0 ? `，发放积分${earnedPoints}` : ''}`,
            },
          });
          return true;
        });

        if (claimed) completedCount += 1;
      } catch (error) {
        this.cancellationLogger.error(
          `自动完成订单失败：orderId=${order.id}, orderNo=${order.orderNo}, error=${(error as Error).message}`,
          (error as Error).stack,
        );
      }
    }

    return { completedCount };
  }

  private async cancelPendingOrder(input: {
    orderId: string;
    userId?: bigint;
    reason: string;
    stockReason: string;
    operatorType: 'user' | 'admin';
    operatorId?: bigint;
    action: string;
    logContent: string;
    pointsSource: string;
    pointsDescription: (points: number) => string;
    couponStatuses: number[];
  }) {
    const orderId = BigInt(input.orderId);
    const order = await this.cancellationPrisma.order.findFirst({
      where: {
        id: orderId,
        ...(input.userId !== undefined ? { userId: input.userId } : {}),
      },
      include: { orderItems: true },
    });
    if (!order) throw new NotFoundException('订单不存在');

    const result = await this.cancellationPrisma.$transaction(async (tx) => {
      const claimed = await tx.order.updateMany({
        where: {
          id: orderId,
          ...(input.userId !== undefined ? { userId: input.userId } : {}),
          status: OrderStatus.pending_payment,
        },
        data: {
          status: OrderStatus.cancelled,
          cancelledAt: new Date(),
          cancelReason: input.reason,
        },
      });

      if (claimed.count === 0) {
        const currentOrder = await tx.order.findFirst({ where: { id: orderId } });
        if (!currentOrder) throw new NotFoundException('订单不存在');
        if (currentOrder.status === OrderStatus.cancelled) return currentOrder;

        const paidStatuses: OrderStatus[] = [
          OrderStatus.pending_delivery,
          OrderStatus.pending_pickup,
          OrderStatus.delivered,
          OrderStatus.completed,
          OrderStatus.aftersale,
        ];
        if (paidStatuses.includes(currentOrder.status)) {
          throw new BadRequestException(
            input.operatorType === 'admin'
              ? '订单已支付，不能取消'
              : '订单已支付或状态已变化，不能取消',
          );
        }
        throw new BadRequestException(`订单状态不允许取消: ${currentOrder.status}`);
      }

      for (const item of order.orderItems) {
        await this.restoreSkuStockAndSalesAuthoritative(tx, item, input.stockReason, 2);
      }

      await this.restoreDeductedPoints(
        tx,
        order.userId,
        order.pointsDeducted,
        input.pointsSource,
        order.id,
        input.pointsDescription(order.pointsDeducted),
      );

      if (order.couponId) {
        await tx.userCoupon.updateMany({
          where: {
            id: order.couponId,
            status: { in: input.couponStatuses },
          },
          data: {
            status: COUPON_STATUS.FREE,
            usedOrderId: null,
            ...(input.operatorType === 'user' ? { usedAt: null } : {}),
          },
        });
      }

      await tx.orderLog.create({
        data: {
          orderId,
          operatorType: input.operatorType,
          ...(input.operatorId !== undefined ? { operatorId: input.operatorId } : {}),
          action: input.action,
          content: input.logContent,
        },
      });

      return tx.order.findFirst({ where: { id: orderId } });
    });

    try {
      await this.cancellationGroupBuyService.handleOrderCancel(input.orderId);
    } catch (error) {
      this.cancellationLogger.error(
        `拼团成员取消失败: orderId=${input.orderId}`,
        (error as Error).message,
      );
    }

    try {
      await this.cancellationFlashSaleService.handleOrderCancel(input.orderId);
    } catch (error) {
      this.cancellationLogger.error(
        `秒杀订单取消失败: orderId=${input.orderId}`,
        (error as Error).message,
      );
    }

    return (this as any).serializeOrderView(result);
  }

  private async restoreDeductedPoints(
    tx: any,
    userId: bigint,
    points: number,
    source: string,
    sourceId: bigint,
    description: string,
  ) {
    if (points <= 0) return;

    // The UPDATE itself is the serialization point on the user row. Never calculate the ledger
    // balance from a preceding snapshot: two concurrent cancellations can both read the same old
    // balance even though their increments are serialized by InnoDB.
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: { availablePoints: { increment: points } },
      select: { availablePoints: true },
    });

    await tx.pointsRecord.create({
      data: {
        userId,
        type: 1,
        points,
        balance: updatedUser.availablePoints,
        source,
        sourceId,
        description,
      },
    });
  }

  private async restoreSkuStockAndSalesAuthoritative(
    tx: any,
    item: any,
    reason: string,
    type: number,
  ) {
    const sku = await tx.productSku.findUnique({
      where: { id: item.skuId },
      select: { id: true },
    });
    if (!sku) return;

    // The increment holds the SKU row lock until commit. Derive the stock ledger snapshot from
    // the returned post-update value so concurrent cancellations cannot log duplicate ranges.
    const updatedSku = await tx.productSku.update({
      where: { id: item.skuId },
      data: { stock: { increment: item.quantity } },
      select: { stock: true },
    });
    await (this as any).safeDecrementSkuSales(tx, item.skuId, item.quantity);

    await tx.productStockLog.create({
      data: {
        productId: item.productId,
        skuId: item.skuId,
        type,
        quantity: item.quantity,
        beforeStock: updatedSku.stock - item.quantity,
        afterStock: updatedSku.stock,
        reason,
      },
    });
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
