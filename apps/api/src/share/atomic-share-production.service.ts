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

      // The user row serializes concurrent share submissions from the same account. The database
      // ledger, not Redis, is authoritative for the daily ordinal so a cache increment can never
      // consume reward eligibility independently from the points transaction.
      const [previousShareCount, eligibleHistory] = await Promise.all([
        tx.shareRecord.count({
          where: { userId: userIdValue, createdAt: { gte: start, lt: end } },
        }),
        tx.shareRecord.findMany({
          where: { userId: userIdValue, createdAt: { gte: start, lt: end } },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          take: POINTS_SHARE_DAILY_LIMIT,
          select: { id: true },
        }),
      ]);

      // Repair same-day records left by the historical non-atomic implementation: a share record
      // could previously commit before points issuance failed. Only the first daily-limit records
      // are eligible, preserving the original business rule while recovering missing user assets.
      const eligibleIds = eligibleHistory.map((item) => item.id);
      const existingRewards = eligibleIds.length > 0
        ? await tx.pointsRecord.findMany({
            where: { source: 'share', sourceId: { in: eligibleIds } },
            select: { sourceId: true },
          })
        : [];
      const rewardedIds = new Set(
        existingRewards
          .map((record) => record.sourceId?.toString())
          .filter((id): id is string => !!id),
      );
      const missingHistoricalIds = eligibleIds.filter((id) => !rewardedIds.has(id.toString()));

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

      const currentEligible = previousShareCount < POINTS_SHARE_DAILY_LIMIT;
      const rewardSourceIds = currentEligible
        ? [...missingHistoricalIds, shareRecord.id]
        : missingHistoricalIds;
      const totalPointsToIssue = rewardSourceIds.length * POINTS_SHARE_AWARD;

      if (
        totalPointsToIssue > 0 &&
        (
          user.totalPoints > MYSQL_SIGNED_INT_MAX - totalPointsToIssue ||
          user.availablePoints > MYSQL_SIGNED_INT_MAX - totalPointsToIssue
        )
      ) {
        // This happens after shareRecord.create but inside the same transaction, deliberately
        // proving that a failed points grant rolls the share record back rather than consuming a
        // daily reward slot without granting the promised asset.
        throw new BadRequestException('积分余额已达上限，暂无法发放分享奖励');
      }

      if (totalPointsToIssue > 0) {
        const expireAt = this.createPointsExpireAt();
        let runningBalance = user.availablePoints;
        for (const sourceId of rewardSourceIds) {
          runningBalance += POINTS_SHARE_AWARD;
          await tx.pointsRecord.create({
            data: {
              userId: userIdValue,
              type: 1,
              points: POINTS_SHARE_AWARD,
              balance: runningBalance,
              source: 'share',
              sourceId,
              description: `分享奖励${POINTS_SHARE_AWARD}积分`,
              expireAt,
            },
          });
        }
        await tx.user.update({
          where: { id: userIdValue },
          data: {
            totalPoints: { increment: totalPointsToIssue },
            availablePoints: { increment: totalPointsToIssue },
          },
        });
      }

      return {
        shareRecordId: shareRecord.id.toString(),
        sceneCode,
        pointsAwarded: currentEligible ? POINTS_SHARE_AWARD : 0,
        recoveredPoints: missingHistoricalIds.length * POINTS_SHARE_AWARD,
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
