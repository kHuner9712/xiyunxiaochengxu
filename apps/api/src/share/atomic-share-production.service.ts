import { BadRequestException, Injectable } from '@nestjs/common';
import { POINTS_EXPIRE_MONTHS, POINTS_SHARE_AWARD, POINTS_SHARE_DAILY_LIMIT } from '@baby-mall/shared';
import * as crypto from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { CouponService } from '../coupon/coupon.service';
import { PointsService } from '../points/points.service';
import { SystemConfigService } from '../system-config/system-config.service';
import { SafeShareProductionService } from './safe-share-production.service';

const CHINA_OFFSET_MS = 8 * 60 * 60 * 1000;
const MYSQL_SIGNED_INT_MAX = 2_147_483_647;

@Injectable()
export class AtomicShareProductionService extends SafeShareProductionService {
  constructor(
    private readonly atomicSharePrisma: PrismaService,
    redisService: RedisService,
    pointsService: PointsService,
    couponService: CouponService,
    systemConfigService: SystemConfigService,
  ) {
    super(atomicSharePrisma, redisService, pointsService, couponService, systemConfigService);
  }

  override async recordShare(
    userId: string,
    data: {
      shareType: string;
      shareTargetId?: string;
      shareChannel?: string;
      campaignId?: string;
      shareScene?: string;
      sharePath?: string;
    },
  ) {
    const userIdValue = parsePositiveBigIntId(userId, '用户');
    const shareTargetId = data.shareTargetId
      ? parsePositiveBigIntId(data.shareTargetId, '分享目标')
      : null;
    const campaignId = data.campaignId
      ? parsePositiveBigIntId(data.campaignId, '裂变活动')
      : null;
    const { start, end } = this.chinaDayBounds();
    const sceneCode = crypto.randomBytes(12).toString('hex');

    const result = await this.atomicSharePrisma.$transaction(async (tx) => {
      const users = await tx.$queryRaw<Array<{
        id: bigint;
        totalPoints: number;
        availablePoints: number;
      }>>`
        SELECT
          id,
          total_points AS totalPoints,
          available_points AS availablePoints
        FROM users
        WHERE id = ${userIdValue}
          AND deleted_at IS NULL
          AND status = 1
        FOR UPDATE
      `;
      const user = users[0];
      if (!user) throw new BadRequestException('用户不存在或已停用');

      // Locking the user row serializes concurrent share submissions from the same account, so
      // both the daily ordinal and the reward eligibility are deterministic without relying on a
      // Redis counter that could advance independently from the points ledger.
      const previousShareCount = await tx.shareRecord.count({
        where: {
          userId: userIdValue,
          createdAt: { gte: start, lt: end },
        },
      });

      const shareRecord = await tx.shareRecord.create({
        data: {
          userId: userIdValue,
          shareType: data.shareType,
          shareId: shareTargetId,
          shareChannel: data.shareChannel || 'wechat',
          campaignId,
          inviterUserId: userIdValue,
          shareScene: data.shareScene || data.shareType,
          sharePath: data.sharePath || null,
          sceneCode,
        },
      });

      let pointsAwarded = 0;
      if (previousShareCount < POINTS_SHARE_DAILY_LIMIT) {
        if (
          user.totalPoints > MYSQL_SIGNED_INT_MAX - POINTS_SHARE_AWARD ||
          user.availablePoints > MYSQL_SIGNED_INT_MAX - POINTS_SHARE_AWARD
        ) {
          // This throw happens after shareRecord.create but within the same transaction. The
          // record therefore rolls back together with the failed reward instead of consuming a
          // daily share slot without granting the promised points.
          throw new BadRequestException('积分余额已达上限，暂无法发放分享奖励');
        }

        pointsAwarded = POINTS_SHARE_AWARD;
        const expireAt = this.createPointsExpireAt();
        await tx.user.update({
          where: { id: userIdValue },
          data: {
            totalPoints: { increment: pointsAwarded },
            availablePoints: { increment: pointsAwarded },
          },
        });
        await tx.pointsRecord.create({
          data: {
            userId: userIdValue,
            type: 1,
            points: pointsAwarded,
            balance: user.availablePoints + pointsAwarded,
            source: 'share',
            sourceId: shareRecord.id,
            description: `分享奖励${pointsAwarded}积分`,
            expireAt,
          },
        });
      }

      return {
        shareRecordId: shareRecord.id.toString(),
        sceneCode,
        pointsAwarded,
        todayShareCount: previousShareCount + 1,
      };
    });

    return {
      success: true,
      ...result,
    };
  }

  private chinaDayBounds() {
    const shifted = new Date(Date.now() + CHINA_OFFSET_MS);
    const baseUtc = Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate(),
    );
    return {
      start: new Date(baseUtc - CHINA_OFFSET_MS),
      end: new Date(baseUtc + 24 * 60 * 60 * 1000 - CHINA_OFFSET_MS),
    };
  }

  private createPointsExpireAt() {
    const expireAt = new Date();
    expireAt.setMonth(expireAt.getMonth() + POINTS_EXPIRE_MONTHS);
    expireAt.setDate(expireAt.getDate() - 1);
    expireAt.setHours(23, 59, 59, 0);
    return expireAt;
  }
}
