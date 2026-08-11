import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { SystemConfigService } from '../system-config/system-config.service';
import { resolveCreateOrderAttribution } from '../order/order-attribution';
import { ActivityCheckoutDto } from './dto/activity-checkout.dto';
import { QuotaSafeActivityMultiItemCheckoutService } from './quota-safe-activity-multi-item-checkout.service';

/**
 * Outermost multi-item activity checkout.
 *
 * The quota-safe parent continues to own activity locks, aggregate gift quotas and the database
 * order transaction. This wrapper only ensures a disabled/deleted merchant promotion code cannot
 * keep attaching itself to future bundle/full-gift orders from stale client storage.
 */
@Injectable()
export class AttributionSafeQuotaActivityMultiItemCheckoutService extends QuotaSafeActivityMultiItemCheckoutService {
  constructor(
    private readonly attributionPrisma: PrismaService,
    redisService: RedisService,
    systemConfigService: SystemConfigService,
  ) {
    super(attributionPrisma, redisService, systemConfigService);
  }

  override async createOrder(
    userId: bigint,
    activityId: bigint,
    anchorActivityProductId: bigint,
    anchorSkuId: bigint,
    dto: ActivityCheckoutDto,
  ) {
    const resolvedDto = await resolveCreateOrderAttribution(this.attributionPrisma, dto);
    return super.createOrder(
      userId,
      activityId,
      anchorActivityProductId,
      anchorSkuId,
      resolvedDto,
    );
  }
}
