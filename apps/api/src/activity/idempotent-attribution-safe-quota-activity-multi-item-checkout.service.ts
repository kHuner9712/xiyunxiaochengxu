import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import {
  buildPromotionCheckoutOrderNo,
  createPromotionCheckoutPrismaProxy,
  normalizePromotionClientRequestId,
  PromotionCheckoutIdempotencyContext,
} from '../common/utils/promotion-checkout-idempotency';
import { SystemConfigService } from '../system-config/system-config.service';
import { ActivityCheckoutDto } from './dto/activity-checkout.dto';
import { AttributionSafeQuotaActivityMultiItemCheckoutService } from './attribution-safe-quota-activity-multi-item-checkout.service';

@Injectable()
export class IdempotentAttributionSafeQuotaActivityMultiItemCheckoutService extends AttributionSafeQuotaActivityMultiItemCheckoutService {
  private readonly idempotencyStorage: AsyncLocalStorage<PromotionCheckoutIdempotencyContext>;
  private readonly sourcePrisma: PrismaService;

  constructor(
    prisma: PrismaService,
    redisService: RedisService,
    systemConfigService: SystemConfigService,
  ) {
    const storage = new AsyncLocalStorage<PromotionCheckoutIdempotencyContext>();
    super(
      createPromotionCheckoutPrismaProxy(prisma, storage),
      redisService,
      systemConfigService,
    );
    this.sourcePrisma = prisma;
    this.idempotencyStorage = storage;
  }

  override async createOrder(
    userId: bigint,
    activityId: bigint,
    anchorActivityProductId: bigint,
    anchorSkuId: bigint,
    dto: ActivityCheckoutDto,
  ) {
    const clientRequestId = normalizePromotionClientRequestId(dto.clientRequestId);
    const orderNo = buildPromotionCheckoutOrderNo(
      userId,
      `activity:${activityId}:${anchorActivityProductId}:${anchorSkuId}`,
      clientRequestId,
    );

    const existing = await this.recoverCheckout(
      userId,
      activityId,
      anchorActivityProductId,
      orderNo,
    );
    if (existing) return existing;

    try {
      return await this.idempotencyStorage.run(
        { userId: userId.toString(), orderNo },
        () => super.createOrder(
          userId,
          activityId,
          anchorActivityProductId,
          anchorSkuId,
          dto,
        ),
      );
    } catch (error) {
      // The existing activity transaction owns all inventory/gift-quota mutations. If an identical
      // retry loses the order_no unique-key race, that transaction rolls back entirely and returns
      // the winner here instead of consuming quota a second time.
      const recovered = await this.recoverCheckout(
        userId,
        activityId,
        anchorActivityProductId,
        orderNo,
      );
      if (recovered) return recovered;
      throw error;
    }
  }

  private async recoverCheckout(
    userId: bigint,
    activityId: bigint,
    activityProductId: bigint,
    orderNo: string,
  ) {
    const order = await this.sourcePrisma.order.findFirst({
      where: { orderNo, userId },
      select: {
        id: true,
        orderNo: true,
        payAmount: true,
        status: true,
        fulfillmentType: true,
      },
    });
    if (!order) return null;

    return {
      orderId: order.id.toString(),
      orderNo: order.orderNo,
      payAmount: order.payAmount,
      isZeroPay: order.payAmount === 0,
      status: order.status,
      fulfillmentType: order.fulfillmentType,
      activityId: activityId.toString(),
      activityProductId: activityProductId.toString(),
    };
  }
}
