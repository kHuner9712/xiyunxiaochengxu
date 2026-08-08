import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { CouponService } from '../coupon/coupon.service';
import { PointsService } from '../points/points.service';
import { SystemConfigService } from '../system-config/system-config.service';
import { DurableRewardProductionShareService } from './durable-reward-production-share.service';

const POSTER_TYPES = new Set(['product', 'activity', 'content', 'invite', 'home']);

@Injectable()
export class SafeShareProductionService extends DurableRewardProductionShareService {
  constructor(
    private readonly safeSharePrisma: PrismaService,
    redisService: RedisService,
    pointsService: PointsService,
    couponService: CouponService,
    systemConfigService: SystemConfigService,
  ) {
    super(safeSharePrisma, redisService, pointsService, couponService, systemConfigService);
  }

  override async getPoster(userId: string, type: string, targetId?: string) {
    const userIdValue = parsePositiveBigIntId(userId, '用户');
    if (!POSTER_TYPES.has(type)) throw new BadRequestException('分享海报类型无效');

    const posterData: any = {
      type,
      userId: userIdValue.toString(),
      qrCodeUrl: '',
      shareUrl: '',
    };

    if (type === 'product') {
      if (!targetId) throw new BadRequestException('商品分享缺少商品ID');
      const productId = parsePositiveBigIntId(targetId, '商品');
      const product = await this.safeSharePrisma.product.findFirst({
        where: { id: productId, deletedAt: null, status: 1 },
        select: { id: true, name: true, mainImage: true, minPrice: true },
      });
      if (!product) throw new NotFoundException('商品不存在或已下架');
      posterData.product = { ...product, id: product.id.toString() };
      posterData.shareUrl = `/pages/product/detail?id=${product.id}&inviter=${userIdValue}`;
      return posterData;
    }

    if (type === 'activity') {
      if (!targetId) throw new BadRequestException('活动分享缺少活动ID');
      const activityId = parsePositiveBigIntId(targetId, '活动');
      const now = new Date();
      const activity = await this.safeSharePrisma.activity.findFirst({
        where: {
          id: activityId,
          status: 1,
          startTime: { lte: now },
          endTime: { gte: now },
        },
        select: { id: true, name: true, bannerImage: true, type: true },
      });
      if (!activity || !['1', '2', '5'].includes(String(activity.type))) {
        throw new NotFoundException('活动不存在、未进行中或当前类型尚未开放购买');
      }
      posterData.activity = { ...activity, id: activity.id.toString() };
      posterData.shareUrl = `/pages/activity/detail?id=${activity.id}&inviter=${userIdValue}`;
      return posterData;
    }

    if (type === 'content') {
      if (!targetId) throw new BadRequestException('内容分享缺少内容ID');
      const contentId = parsePositiveBigIntId(targetId, '内容');
      const content = await this.safeSharePrisma.content.findFirst({
        where: { id: contentId, status: 1 },
        select: { id: true, title: true, coverImage: true },
      });
      if (!content) throw new NotFoundException('内容不存在或未发布');
      posterData.content = { ...content, id: content.id.toString() };
      posterData.shareUrl = `/pages/content/detail?id=${content.id}&inviter=${userIdValue}`;
      return posterData;
    }

    if (type === 'invite') {
      const user = await this.safeSharePrisma.user.findFirst({
        where: { id: userIdValue, deletedAt: null },
        select: { id: true, nickname: true, avatarUrl: true },
      });
      if (!user) throw new NotFoundException('用户不存在');
      posterData.inviter = { ...user, id: user.id.toString() };
      posterData.shareUrl = `/pages/share/invite?inviter=${user.id}`;
      return posterData;
    }

    posterData.shareUrl = `/pages/home/index?inviter=${userIdValue}`;
    return posterData;
  }
}
