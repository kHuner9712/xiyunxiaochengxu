import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { BenefitPackageService } from '../benefit-package/benefit-package.service';
import { OrderService } from '../order/order.service';
import { PromotionCheckoutService } from '../order/promotion-checkout.service';
import { FlashSaleService } from './flash-sale.service';
import {
  FlashSaleActivityDto,
  FlashSaleBuyDto,
} from './dto/flash-sale.dto';

@Injectable()
export class TransactionalFlashSaleService extends FlashSaleService {
  private readonly transactionalLogger = new Logger(
    TransactionalFlashSaleService.name,
  );

  constructor(
    private readonly transactionalPrisma: PrismaService,
    @Inject(forwardRef(() => OrderService))
    private readonly transactionalOrderService: OrderService,
    private readonly promotionCheckout: PromotionCheckoutService,
    private readonly benefitPackageService: BenefitPackageService,
  ) {
    super(transactionalPrisma, transactionalOrderService);
  }

  override async createActivity(dto: FlashSaleActivityDto) {
    await this.assertActivityProductSku(dto);
    return super.createActivity(dto);
  }

  override async updateActivity(id: string, dto: FlashSaleActivityDto) {
    parsePositiveBigIntId(id, '活动');
    await this.assertActivityProductSku(dto);
    return super.updateActivity(id, dto);
  }

  override async weappFindActivityById(id: string) {
    const activityId = parsePositiveBigIntId(id, '活动');
    const activity = await this.transactionalPrisma.flashSaleActivity.findFirst({
      where: { id: activityId, deletedAt: null },
    });
    if (!activity) throw new NotFoundException('活动不存在');
    return { ...activity, now: new Date().toISOString() };
  }

  override async weappBuy(userId: string, dto: FlashSaleBuyDto) {
    this.promotionCheckout.assertNoUnsupportedStacking(dto);

    const userIdValue = parsePositiveBigIntId(userId, '用户');
    const activityId = parsePositiveBigIntId(dto.activityId, '活动');
    const quantity = dto.quantity ?? 1;
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new BadRequestException('数量必须为正整数');
    }

    const result = await this.transactionalPrisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`
          SELECT id FROM flash_sale_activities
          WHERE id = ${activityId}
          FOR UPDATE
        `;
        const activity = await tx.flashSaleActivity.findFirst({
          where: { id: activityId, deletedAt: null },
        });
        if (!activity) throw new NotFoundException('活动不存在');
        if (activity.status !== 1) {
          throw new BadRequestException('活动已下架');
        }

        const now = new Date();
        if (now < activity.startTime) {
          throw new BadRequestException('活动未开始');
        }
        if (now >= activity.endTime) {
          throw new BadRequestException('活动已结束');
        }
        if (!activity.skuId) {
          throw new BadRequestException('活动商品规格配置异常');
        }
        await this.assertSkuMatchesActivity(
          tx,
          activity.productId,
          activity.skuId,
          activity.flashPrice,
        );

        const lockExpireAt = new Date(
          Math.min(
            now.getTime() + activity.lockMinutes * 60 * 1000,
            activity.endTime.getTime(),
          ),
        );
        if (lockExpireAt <= now) {
          throw new BadRequestException('活动支付时限已结束');
        }

        if (activity.limitPerUser > 0) {
          const bought = await tx.flashSaleOrder.aggregate({
            where: {
              activityId: activity.id,
              userId: userIdValue,
              status: { in: ['pending_payment', 'paid'] },
              deletedAt: null,
            },
            _sum: { quantity: true },
          });
          if ((bought._sum.quantity ?? 0) + quantity > activity.limitPerUser) {
            throw new BadRequestException(
              `每人限购 ${activity.limitPerUser} 件`,
            );
          }
        }

        const locked = await tx.$executeRaw`
          UPDATE flash_sale_activities
          SET locked_count = locked_count + ${quantity},
              updated_at = NOW(3)
          WHERE id = ${activity.id}
            AND status = 1
            AND deleted_at IS NULL
            AND start_time <= NOW(3)
            AND end_time > NOW(3)
            AND stock_limit - sold_count - locked_count >= ${quantity}
        `;
        if (locked === 0) {
          throw new BadRequestException('秒杀库存不足或活动状态已变化');
        }

        const order = await this.promotionCheckout.createOrder(tx, {
          userId: userIdValue,
          skuId: activity.skuId,
          quantity,
          unitPrice: activity.flashPrice,
          activityId: activity.id,
          activityType: 'flash_sale',
          addressId: dto.addressId,
          pickupStoreId: dto.pickupStoreId,
          fulfillmentType: dto.fulfillmentType,
          sourceType: dto.sourceType,
          sourceCode: dto.sourceCode,
          referrerUserId: dto.referrerUserId,
          remark: dto.remark,
          autoCloseAt: lockExpireAt,
        });

        const status = order.isZeroPay ? 'paid' : 'pending_payment';
        const flashSaleOrder = await tx.flashSaleOrder.create({
          data: {
            activityId: activity.id,
            userId: userIdValue,
            orderId: order.orderId,
            orderItemId: order.orderItemId,
            quantity,
            flashPrice: activity.flashPrice,
            status,
            lockExpireAt,
            ...(order.isZeroPay ? { paidAt: now } : {}),
          },
        });

        if (order.isZeroPay) {
          await tx.$executeRaw`
            UPDATE flash_sale_activities
            SET locked_count = GREATEST(locked_count - ${quantity}, 0),
                sold_count = sold_count + ${quantity},
                updated_at = NOW(3)
            WHERE id = ${activity.id}
          `;
        }

        return {
          response: {
            flashSaleOrderId: flashSaleOrder.id.toString(),
            orderId: order.orderId.toString(),
            flashPrice: activity.flashPrice,
            quantity,
            lockExpireAt: lockExpireAt.toISOString(),
          },
          zeroPayOrderId: order.isZeroPay ? order.orderId : null,
          zeroPayUserId: order.isZeroPay ? userIdValue : null,
        };
      },
      { timeout: 15_000 },
    );

    if (result.zeroPayOrderId && result.zeroPayUserId) {
      try {
        await this.benefitPackageService.grantBenefitsForOrder(
          result.zeroPayOrderId,
          result.zeroPayUserId,
        );
      } catch (error) {
        this.transactionalLogger.error(
          `零元秒杀权益发放失败: orderId=${result.zeroPayOrderId}`,
          (error as Error).message,
        );
      }
    }

    return result.response;
  }

  override async handlePaymentSuccess(orderId: bigint | string): Promise<void> {
    const orderIdValue = parsePositiveBigIntId(orderId, '订单');
    await this.transactionalPrisma.$transaction(async (tx) => {
      const fsOrder = await tx.flashSaleOrder.findFirst({
        where: { orderId: orderIdValue, deletedAt: null },
      });
      if (!fsOrder || fsOrder.status === 'paid') return;
      if (fsOrder.status !== 'pending_payment') {
        throw new BadRequestException(`秒杀订单状态不允许确认成交: ${fsOrder.status}`);
      }

      const order = await tx.order.findUnique({
        where: { id: orderIdValue },
        select: { status: true },
      });
      if (!order) throw new NotFoundException('订单不存在');
      const paidStatuses: OrderStatus[] = [
        OrderStatus.paid,
        OrderStatus.pending_delivery,
        OrderStatus.pending_pickup,
        OrderStatus.delivered,
        OrderStatus.completed,
        OrderStatus.aftersale,
      ];
      if (!paidStatuses.includes(order.status)) {
        if (order.status === OrderStatus.cancelled) {
          throw new BadRequestException('订单已取消，不能计入秒杀成交');
        }
        throw new BadRequestException(`订单尚未完成支付: ${order.status}`);
      }

      const result = await tx.flashSaleOrder.updateMany({
        where: { id: fsOrder.id, status: 'pending_payment' },
        data: { status: 'paid', paidAt: new Date() },
      });
      if (result.count === 0) return;

      await tx.$executeRaw`
        UPDATE flash_sale_activities
        SET locked_count = GREATEST(locked_count - ${fsOrder.quantity}, 0),
            sold_count = sold_count + ${fsOrder.quantity},
            updated_at = NOW(3)
        WHERE id = ${fsOrder.activityId}
      `;
    });
  }

  override async handleOrderCancel(orderId: bigint | string): Promise<void> {
    const orderIdValue = parsePositiveBigIntId(orderId, '订单');
    await this.transactionalPrisma.$transaction(async (tx) => {
      const fsOrder = await tx.flashSaleOrder.findFirst({
        where: { orderId: orderIdValue, deletedAt: null },
      });
      if (!fsOrder || fsOrder.status !== 'pending_payment') return;

      const result = await tx.flashSaleOrder.updateMany({
        where: { id: fsOrder.id, status: 'pending_payment' },
        data: { status: 'cancelled', cancelledAt: new Date() },
      });
      if (result.count === 0) return;

      await tx.$executeRaw`
        UPDATE flash_sale_activities
        SET locked_count = GREATEST(locked_count - ${fsOrder.quantity}, 0),
            updated_at = NOW(3)
        WHERE id = ${fsOrder.activityId}
      `;
    });
  }

  override async releaseExpiredLocks() {
    type RecoveryCandidate = {
      id: bigint;
      orderId: bigint;
      activityId: bigint;
      quantity: number;
      orderStatus: OrderStatus | null;
    };

    // Recover already-terminal business facts first, even before the original payment lock expires.
    // Only a still-pending ordinary order needs to wait for lock_expire_at. This prevents a large
    // block of uncertain payments from monopolizing the 200-row batch and starving paid/cancelled
    // flash-sale rows whose inventory state can be settled immediately.
    const candidates = await this.transactionalPrisma.$queryRaw<RecoveryCandidate[]>`
      SELECT
        fso.id AS id,
        fso.order_id AS orderId,
        fso.activity_id AS activityId,
        fso.quantity AS quantity,
        o.status AS orderStatus
      FROM flash_sale_orders fso
      LEFT JOIN orders o ON o.id = fso.order_id
      WHERE fso.status = 'pending_payment'
        AND fso.deleted_at IS NULL
        AND (
          o.id IS NULL
          OR o.status <> ${OrderStatus.pending_payment}
          OR fso.lock_expire_at <= NOW(3)
        )
      ORDER BY
        CASE
          WHEN o.id IS NULL THEN 0
          WHEN o.status <> ${OrderStatus.pending_payment} THEN 0
          ELSE 1
        END ASC,
        fso.lock_expire_at ASC,
        fso.id ASC
      LIMIT 200
    `;

    let released = 0;
    let deferred = 0;
    let settled = 0;
    let failed = 0;

    for (const fsOrder of candidates) {
      try {
        const orderStatus = fsOrder.orderStatus;
        if (!orderStatus) {
          failed += 1;
          this.transactionalLogger.error(
            `秒杀库存锁对应订单不存在: flashSaleOrder=${fsOrder.id}`,
          );
          continue;
        }

        if (orderStatus === OrderStatus.pending_payment) {
          deferred += 1;
          continue;
        }

        if (orderStatus === OrderStatus.cancelled) {
          await this.transactionalPrisma.$transaction(async (tx) => {
            const claim = await tx.flashSaleOrder.updateMany({
              where: { id: fsOrder.id, status: 'pending_payment' },
              data: { status: 'expired', expiredAt: new Date() },
            });
            if (claim.count === 0) return;
            await tx.$executeRaw`
              UPDATE flash_sale_activities
              SET locked_count = GREATEST(locked_count - ${fsOrder.quantity}, 0),
                  updated_at = NOW(3)
              WHERE id = ${fsOrder.activityId}
            `;
            released += 1;
          });
          continue;
        }

        const paidStatuses: OrderStatus[] = [
          OrderStatus.paid,
          OrderStatus.pending_delivery,
          OrderStatus.pending_pickup,
          OrderStatus.delivered,
          OrderStatus.completed,
          OrderStatus.aftersale,
        ];
        if (paidStatuses.includes(orderStatus)) {
          await this.handlePaymentSuccess(fsOrder.orderId);
          settled += 1;
          continue;
        }

        deferred += 1;
      } catch (error) {
        failed += 1;
        this.transactionalLogger.error(
          `秒杀库存锁恢复处理失败: flashSaleOrder=${fsOrder.id}, error=${(error as Error).message}`,
        );
      }
    }

    if (released || deferred || settled || failed) {
      this.transactionalLogger.log(
        `秒杀库存锁恢复处理: released=${released}, deferred=${deferred}, settled=${settled}, failed=${failed}`,
      );
    }
    return { released, deferred, settled, failed };
  }

  private async assertActivityProductSku(dto: FlashSaleActivityDto): Promise<void> {
    const productId = parsePositiveBigIntId(dto.productId, '商品');
    const skuId = parsePositiveBigIntId(dto.skuId, 'SKU ');
    const sku = await this.transactionalPrisma.productSku.findFirst({
      where: { id: skuId, status: 1 },
      include: { product: true },
    });
    if (!sku || sku.product.status !== 1) {
      throw new BadRequestException('商品规格不存在或已下架');
    }
    if (sku.productId !== productId) {
      throw new BadRequestException('SKU不属于所选商品');
    }
    if (dto.flashPrice > sku.price) {
      throw new BadRequestException('秒杀价不能高于当前SKU价格');
    }
    if (dto.stockLimit <= 0) {
      throw new BadRequestException('秒杀活动库存必须大于0');
    }
  }

  private async assertSkuMatchesActivity(
    tx: Prisma.TransactionClient,
    productId: bigint,
    skuId: bigint,
    activityPrice: number,
  ): Promise<void> {
    const sku = await tx.productSku.findFirst({
      where: { id: skuId, status: 1 },
      include: { product: true },
    });
    if (!sku || sku.product.status !== 1) {
      throw new BadRequestException('活动商品规格不存在或已下架');
    }
    if (sku.productId !== productId) {
      throw new BadRequestException('活动SKU与商品不匹配');
    }
    if (activityPrice > sku.price) {
      throw new BadRequestException('活动价格不能高于当前SKU价格');
    }
  }
}
