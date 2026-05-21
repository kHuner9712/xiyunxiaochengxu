import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { POINTS_SHARE_AWARD, POINTS_SHARE_DAILY_LIMIT } from '@baby-mall/shared';
import { PointsService } from '../points/points.service';

@Injectable()
export class ShareService {
  private readonly logger = new Logger(ShareService.name);

  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
    private pointsService: PointsService,
  ) {}

  async recordShare(userId: string, shareType: string, shareTargetId?: string, shareChannel?: string) {
    const shareRecord = await this.prisma.shareRecord.create({
      data: {
        userId: BigInt(userId),
        shareType,
        shareId: shareTargetId ? BigInt(shareTargetId) : null,
        shareChannel: shareChannel || 'wechat',
      },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cacheKey = `share:count:${userId}:${today.toISOString().split('T')[0]}`;
    const todayCount = await this.redisService.incr(cacheKey);
    if (todayCount === 1) {
      await this.redisService.expire(cacheKey, 86400);
    }

    let pointsAwarded = 0;
    if (todayCount <= POINTS_SHARE_DAILY_LIMIT) {
      await this.pointsService.earnPoints(
        userId,
        POINTS_SHARE_AWARD,
        'share',
        shareRecord.id.toString(),
        `分享奖励${POINTS_SHARE_AWARD}积分`,
      );
      pointsAwarded = POINTS_SHARE_AWARD;
    }

    this.logger.log(`用户${userId}分享：${shareType}，渠道：${shareChannel}，积分奖励：${pointsAwarded}`);
    return {
      success: true,
      pointsAwarded,
      todayShareCount: todayCount,
    };
  }

  async getPoster(userId: string, type: string, targetId?: string) {
    let posterData: any = {
      type,
      userId,
      qrCodeUrl: '',
      shareUrl: '',
    };

    if (type === 'product' && targetId) {
      const product = await this.prisma.product.findFirst({
        where: { id: BigInt(targetId), deletedAt: null, status: 1 },
        select: { id: true, name: true, mainImage: true, minPrice: true },
      });
      if (product) {
        posterData.product = {
          ...product,
          id: product.id.toString(),
        };
        posterData.shareUrl = `/pages/product/detail?id=${product.id}`;
      }
    } else if (type === 'activity' && targetId) {
      const activity = await this.prisma.activity.findFirst({
        where: { id: BigInt(targetId), status: 2 },
        select: { id: true, name: true, bannerImage: true },
      });
      if (activity) {
        posterData.activity = {
          ...activity,
          id: activity.id.toString(),
        };
        posterData.shareUrl = `/pages/activity/detail?id=${activity.id}`;
      }
    } else if (type === 'invite') {
      const user = await this.prisma.user.findFirst({
        where: { id: BigInt(userId) },
        select: { id: true, nickname: true, avatarUrl: true },
      });
      if (user) {
        posterData.inviter = {
          ...user,
          id: user.id.toString(),
        };
        posterData.shareUrl = `/pages/invite?inviter=${user.id}`;
      }
    }

    return posterData;
  }
}
