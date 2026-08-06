import {
  forwardRef,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { BusinessEventService } from '../common/business-event.service';
import { COUPON_STATUS } from '../common/constants/payment';
import { BenefitPackageService } from '../benefit-package/benefit-package.service';
import { FlashSaleService } from '../flash-sale/flash-sale.service';
import { GroupBuyService } from '../group-buy/group-buy.service';
import { OrderService } from './order.service';

@Injectable()
export class TransactionalOrderService extends OrderService {
  private readonly timeoutLogger = new Logger(TransactionalOrderService.name);

  constructor(
    private readonly transactionalPrisma: PrismaService,
    businessEvent: BusinessEventService,
    benefitPackageService: BenefitPackageService,
    @Inject(forwardRef(() => GroupBuyService))
    groupBuyService: GroupBuyService,
    @Inject(forwardRef(() => FlashSaleService))
    flashSaleService: FlashSaleService,
  ) {
    super(
      transactionalPrisma,
      businessEvent,
      benefitPackageService,
      groupBuyService,
      flashSaleService,
    );
  }

  override async closeTimeoutOrders() {
    const now = new Date();
    const timeoutOrders = await this.transactionalPrisma.order.findMany({
      where: {
        status: OrderStatus.pending_payment,
        autoCloseAt: { lte: now },
      },
      include: { orderItems: true },
    });

    if (timeoutOrders.length === 0) return { closedCount: 0 };

    let closedCount = 0;
    for (const order of timeoutOrders) {
      try {
        const claimed = await this.transactionalPrisma.$transaction(
          async (tx) => {
            const closedAt = new Date();
            const claimResult = await tx.order.updateMany({
              where: {
                id: order.id,
                status: OrderStatus.pending_payment,
                autoCloseAt: { lte: closedAt },
              },
              data: {
                status: OrderStatus.cancelled,
                cancelledAt: closedAt,
                cancelReason: '超时未支付自动关闭',
              },
            });
            if (claimResult.count === 0) return false;

            for (const item of order.orderItems) {
              const sku = await tx.productSku.findUnique({
                where: { id: item.skuId },
                select: { id: true, stock: true },
              });
              if (!sku) continue;

              await tx.productSku.update({
                where: { id: item.skuId },
                data: { stock: { increment: item.quantity } },
              });
              await tx.$executeRaw`
                UPDATE product_skus
                SET sales = GREATEST(sales - ${item.quantity}, 0)
                WHERE id = ${item.skuId}
              `;
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

            if (order.pointsDeducted > 0) {
              const user = await tx.user.findUnique({
                where: { id: order.userId },
                select: { availablePoints: true },
              });
              if (user) {
                await tx.user.update({
                  where: { id: order.userId },
                  data: {
                    availablePoints: { increment: order.pointsDeducted },
                  },
                });
                await tx.pointsRecord.create({
                  data: {
                    userId: order.userId,
                    type: 1,
                    points: order.pointsDeducted,
                    balance: user.availablePoints + order.pointsDeducted,
                    source: 'order_auto_close',
                    sourceId: order.id,
                    description: `超时自动关闭归还积分${order.pointsDeducted}`,
                  },
                });
              }
            }

            if (order.couponId) {
              await tx.userCoupon.updateMany({
                where: {
                  id: order.couponId,
                  status: {
                    in: [COUPON_STATUS.LOCKED, COUPON_STATUS.USED],
                  },
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
                orderId: order.id,
                status: 'pending_payment',
                deletedAt: null,
              },
              select: { id: true, activityId: true, quantity: true },
            });
            if (flashSaleOrder) {
              const flashClaim = await tx.flashSaleOrder.updateMany({
                where: {
                  id: flashSaleOrder.id,
                  status: 'pending_payment',
                },
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
                orderId: order.id,
                status: 'pending_payment',
                deletedAt: null,
              },
              data: { status: 'cancelled' },
            });

            await tx.orderLog.create({
              data: {
                orderId: order.id,
                operatorType: 'system',
                action: 'auto_close',
                content: '超时未支付，系统自动关闭订单及促销占用',
              },
            });

            return true;
          },
          { timeout: 15_000 },
        );

        if (claimed) closedCount += 1;
      } catch (error) {
        this.timeoutLogger.error(
          `自动关闭订单${order.orderNo}失败：${(error as Error).message}`,
        );
      }
    }

    this.timeoutLogger.log(`自动关闭超时订单，共${closedCount}条`);
    return { closedCount };
  }
}
