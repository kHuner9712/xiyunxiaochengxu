import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import {
  loadActiveMemberLevels,
  reconcileMemberLevelForGrowth,
} from '../member/member-level-runtime';
import { AuthoritativeCouponReportingService } from './authoritative-coupon-reporting.service';

/**
 * Heals historical/stale user.memberLevelId before member-gated coupon reads or claims.
 * New order completion/refund paths keep the persisted level synchronized transactionally, while
 * this wrapper closes the historical-data gap without duplicating CouponService's stock/limit logic.
 */
@Injectable()
export class GrowthAwareCouponService extends AuthoritativeCouponReportingService {
  constructor(private readonly growthCouponPrisma: PrismaService) {
    super(growthCouponPrisma);
  }

  override async findAvailable(userId: string) {
    await this.syncMemberLevel(userId, '查询可领取优惠券前同步会员等级');
    return super.findAvailable(userId);
  }

  override async receive(userId: string, couponId: string) {
    await this.syncMemberLevel(userId, '领取会员优惠券前同步会员等级');
    return super.receive(userId, couponId);
  }

  private async syncMemberLevel(userId: string, reason: string) {
    const userIdValue = parsePositiveBigIntId(userId, '用户');
    await this.growthCouponPrisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userIdValue} AND deleted_at IS NULL FOR UPDATE`;
      const user = await tx.user.findFirst({
        where: { id: userIdValue, deletedAt: null },
        select: { growthValue: true, memberLevelId: true },
      });
      if (!user) return;
      const levels = await loadActiveMemberLevels(tx);
      await reconcileMemberLevelForGrowth(tx, {
        userId: userIdValue,
        currentMemberLevelId: user.memberLevelId,
        growthValue: user.growthValue,
        reason,
        levels,
      });
    });
  }
}
