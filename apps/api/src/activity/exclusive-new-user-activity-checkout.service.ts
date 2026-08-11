import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { PromotionCheckoutService } from '../order/promotion-checkout.service';
import { SystemConfigService } from '../system-config/system-config.service';
import { ActivityCheckoutService } from './activity-checkout.service';
import { ActivityMultiItemCheckoutService } from './activity-multi-item-checkout.service';
import { ActivityCheckoutDto } from './dto/activity-checkout.dto';

@Injectable()
export class ExclusiveNewUserActivityCheckoutService extends ActivityCheckoutService {
  constructor(
    private readonly eligibilityPrisma: PrismaService,
    private readonly eligibilityRedis: RedisService,
    promotionCheckoutService: PromotionCheckoutService,
    systemConfigService: SystemConfigService,
    multiItemCheckoutService: ActivityMultiItemCheckoutService,
  ) {
    super(eligibilityPrisma, promotionCheckoutService, systemConfigService, multiItemCheckoutService);
  }

  override async preview(userId: string, activityId: string, dto: ActivityCheckoutDto) {
    const userIdValue = parsePositiveBigIntId(userId, '用户');
    const activityIdValue = parsePositiveBigIntId(activityId, '活动');
    if (await this.isNewUserActivity(activityIdValue)) {
      await this.assertNoExistingOrder(userIdValue);
    }
    return super.preview(userId, activityId, dto);
  }

  override async createOrder(userId: string, activityId: string, dto: ActivityCheckoutDto) {
    const userIdValue = parsePositiveBigIntId(userId, '用户');
    const activityIdValue = parsePositiveBigIntId(activityId, '活动');
    if (!(await this.isNewUserActivity(activityIdValue))) {
      return super.createOrder(userId, activityId, dto);
    }

    const lockKey = `activity:new-user:${userIdValue}`;
    const lockValue = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const locked = await this.eligibilityRedis.setNX(lockKey, lockValue, 120);
    if (!locked) throw new BadRequestException('新人优惠资格正在处理中，请勿重复提交');

    try {
      // Serialize all type-5 activities for the same user. Existing pending orders also reserve
      // the one-time new-user benefit until they are cancelled, eliminating cross-activity races.
      await this.assertNoExistingOrder(userIdValue);
      return await super.createOrder(userId, activityId, dto);
    } finally {
      await this.eligibilityRedis.releaseLockWithLua(lockKey, lockValue);
    }
  }

  private async isNewUserActivity(activityId: bigint) {
    const activity = await this.eligibilityPrisma.activity.findUnique({
      where: { id: activityId },
      select: { type: true },
    });
    return activity?.type === '5';
  }

  private async assertNoExistingOrder(userId: bigint) {
    const existingOrderCount = await this.eligibilityPrisma.order.count({
      where: {
        userId,
        status: { not: 'cancelled' },
      },
    });
    if (existingOrderCount > 0) {
      throw new BadRequestException('新人优惠仅限尚未创建有效订单的新用户');
    }
  }
}
