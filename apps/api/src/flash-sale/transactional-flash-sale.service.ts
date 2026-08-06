import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { OrderService } from '../order/order.service';
import { PromotionCheckoutService } from '../order/promotion-checkout.service';
import { FlashSaleService } from './flash-sale.service';
import { FlashSaleBuyDto } from './dto/flash-sale.dto';

@Injectable()
export class TransactionalFlashSaleService extends FlashSaleService {
  constructor(
    private readonly transactionalPrisma: PrismaService,
    @Inject(forwardRef(() => OrderService))
    orderService: OrderService,
    private readonly promotionCheckout: PromotionCheckoutService,
  ) {
    super(transactionalPrisma, orderService);
  }

  override async weappBuy(userId: string, dto: FlashSaleBuyDto) {
    this.promotionCheckout.assertNoUnsupportedStacking(dto);

    const userIdValue = BigInt(userId);
    const activityId = BigInt(dto.activityId);
    const quantity = dto.quantity ?? 1;
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new BadRequestException('数量必须为正整数');
    }

    return this.transactionalPrisma.$transaction(
      async (tx) => {
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
          throw new BadRequestException('该活动未指定规格，请联系客服');
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
        });

        const lockExpireAt = new Date(
          now.getTime() + activity.lockMinutes * 60 * 1000,
        );
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
          flashSaleOrderId: flashSaleOrder.id.toString(),
          orderId: order.orderId.toString(),
          flashPrice: activity.flashPrice,
          quantity,
          lockExpireAt: lockExpireAt.toISOString(),
        };
      },
      { timeout: 15_000 },
    );
  }
}
