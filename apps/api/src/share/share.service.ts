import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { PointsService } from '../points/points.service';
import { CouponService } from '../coupon/coupon.service';
import { POINTS_SHARE_AWARD, POINTS_SHARE_DAILY_LIMIT } from '@baby-mall/shared';

@Injectable()
export class ShareService {
  private readonly logger = new Logger(ShareService.name);

  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
    private pointsService: PointsService,
    private couponService: CouponService,
  ) {}

  async recordShare(userId: string, data: {
    shareType: string;
    shareTargetId?: string;
    shareChannel?: string;
    campaignId?: string;
    shareScene?: string;
    sharePath?: string;
  }) {
    const sceneCode = this.generateSceneCode();
    const shareRecord = await this.prisma.shareRecord.create({
      data: {
        userId: BigInt(userId),
        shareType: data.shareType,
        shareId: data.shareTargetId ? BigInt(data.shareTargetId) : null,
        shareChannel: data.shareChannel || 'wechat',
        campaignId: data.campaignId ? BigInt(data.campaignId) : null,
        inviterUserId: BigInt(userId),
        shareScene: data.shareScene || data.shareType,
        sharePath: data.sharePath || null,
        sceneCode,
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

    this.logger.log(`用户${userId}分享：${data.shareType}，渠道：${data.shareChannel}，积分奖励：${pointsAwarded}`);
    return {
      success: true,
      shareRecordId: shareRecord.id.toString(),
      sceneCode,
      pointsAwarded,
      todayShareCount: todayCount,
    };
  }

  async recordVisit(data: { shareRecordId?: string; inviter?: string; campaignId?: string; sceneCode?: string }) {
    let shareRecord: any = null;

    if (data.shareRecordId) {
      shareRecord = await this.prisma.shareRecord.findFirst({
        where: { id: BigInt(data.shareRecordId) },
      });
    } else if (data.sceneCode) {
      shareRecord = await this.prisma.shareRecord.findFirst({
        where: { sceneCode: data.sceneCode },
      });
    }

    if (shareRecord) {
      await this.prisma.shareRecord.update({
        where: { id: shareRecord.id },
        data: { clickCount: { increment: 1 } },
      });

      const cacheKey = `share:visit:${shareRecord.id}`;
      const visited = await this.redisService.get(cacheKey);
      if (!visited) {
        await this.redisService.set(cacheKey, '1', 300);
      }

      this.logger.log(`分享访问记录：shareRecordId=${shareRecord.id}`);
      return { recorded: true, shareRecordId: shareRecord.id.toString() };
    }

    if (data.inviter) {
      const cacheKey = `share:visit:inviter:${data.inviter}`;
      await this.redisService.set(cacheKey, JSON.stringify({
        inviter: data.inviter,
        campaignId: data.campaignId || '',
        visitedAt: new Date().toISOString(),
      }), 86400 * 30);
      return { recorded: true, inviter: data.inviter };
    }

    return { recorded: false };
  }

  async bindInvite(userId: string, data: { inviter?: string; shareRecordId?: string; campaignId?: string }) {
    if (data.inviter && data.inviter === userId) {
      throw new BadRequestException('不能邀请自己');
    }

    const existing = await this.prisma.userInviteRelation.findFirst({
      where: { inviteeUserId: BigInt(userId) },
    });
    if (existing) {
      return { bound: false, reason: 'already_invited' };
    }

    let inviterUserId: bigint | null = null;
    let sourceShareRecordId: bigint | null = null;
    let sourceCampaignId: bigint | null = null;

    if (data.shareRecordId) {
      const shareRecord = await this.prisma.shareRecord.findFirst({
        where: { id: BigInt(data.shareRecordId) },
      });
      if (shareRecord) {
        inviterUserId = shareRecord.inviterUserId || shareRecord.userId;
        sourceShareRecordId = shareRecord.id;
        sourceCampaignId = shareRecord.campaignId;
      }
    } else if (data.inviter) {
      inviterUserId = BigInt(data.inviter);
    }

    if (!inviterUserId) {
      return { bound: false, reason: 'no_inviter' };
    }

    if (inviterUserId === BigInt(userId)) {
      throw new BadRequestException('不能邀请自己');
    }

    if (data.campaignId) {
      sourceCampaignId = BigInt(data.campaignId);
    }

    const relation = await this.prisma.userInviteRelation.create({
      data: {
        inviterUserId,
        inviteeUserId: BigInt(userId),
        sourceShareRecordId,
        sourceCampaignId,
        registeredAt: new Date(),
        status: 1,
      },
    });

    if (sourceShareRecordId) {
      await this.prisma.shareRecord.update({
        where: { id: sourceShareRecordId },
        data: { registerCount: { increment: 1 } },
      });
    }

    await this.processInviteeReward(userId, sourceCampaignId);

    this.logger.log(`绑定邀请关系：inviter=${inviterUserId}, invitee=${userId}`);
    return { bound: true, relationId: relation.id.toString() };
  }

  private async processInviteeReward(inviteeUserId: string, campaignId: bigint | null) {
    if (!campaignId) return;

    const campaign = await this.prisma.shareCampaign.findFirst({
      where: { id: campaignId, status: 1 },
    });
    if (!campaign) return;

    const now = new Date();
    if (now < campaign.startTime || now > campaign.endTime) return;

    const inviteeConfig: any = campaign.inviteeRewardConfig;
    if (!inviteeConfig) return;

    if (campaign.rewardType === 'points' || campaign.rewardType === 'both') {
      const points = inviteeConfig.points || 0;
      if (points > 0) {
        const sourceId = `invitee_register_${campaignId}`;
        const existing = await this.prisma.pointsRecord.findFirst({
          where: { source: 'invitee_register', sourceId: BigInt(sourceId), userId: BigInt(inviteeUserId) },
        });
        if (!existing) {
          await this.pointsService.earnPoints(
            inviteeUserId,
            points,
            'invitee_register',
            sourceId,
            `被邀请注册奖励${points}积分`,
          );
        }
      }
    }

    if (campaign.rewardType === 'coupon' || campaign.rewardType === 'both') {
      const couponId = inviteeConfig.couponId;
      if (couponId) {
        try {
          await this.couponService.receive(inviteeUserId, couponId);
        } catch {}
      }
    }
  }

  async processFirstPaidReward(inviteeUserId: string, orderId: string, paidAmount: number) {
    const relation = await this.prisma.userInviteRelation.findFirst({
      where: { inviteeUserId: BigInt(inviteeUserId), status: 1 },
    });
    if (!relation) return;

    if (relation.firstPaidOrderId) {
      this.logger.log(`首单奖励已发放，幂等跳过：invitee=${inviteeUserId}`);
      return;
    }

    await this.prisma.userInviteRelation.update({
      where: { id: relation.id },
      data: {
        firstPaidOrderId: BigInt(orderId),
        firstPaidAt: new Date(),
      },
    });

    if (relation.sourceShareRecordId) {
      await this.prisma.shareRecord.update({
        where: { id: relation.sourceShareRecordId },
        data: {
          orderCount: { increment: 1 },
          paidOrderAmount: { increment: paidAmount },
        },
      });
    }

    if (!relation.sourceCampaignId) return;

    const campaign = await this.prisma.shareCampaign.findFirst({
      where: { id: relation.sourceCampaignId, status: 1 },
    });
    if (!campaign) return;

    const now = new Date();
    if (now < campaign.startTime || now > campaign.endTime) {
      this.logger.log(`活动已过期，不发放首单奖励：campaign=${campaign.id}`);
      return;
    }

    const inviterConfig: any = campaign.inviterRewardConfig;
    if (!inviterConfig) return;

    const inviterUserId = relation.inviterUserId.toString();

    if (campaign.rewardType === 'points' || campaign.rewardType === 'both') {
      const points = inviterConfig.points || 0;
      if (points > 0) {
        const sourceId = orderId;
        const existing = await this.prisma.pointsRecord.findFirst({
          where: { source: 'inviter_first_paid', sourceId: BigInt(sourceId) },
        });
        if (!existing) {
          await this.pointsService.earnPoints(
            inviterUserId,
            points,
            'inviter_first_paid',
            sourceId,
            `邀请好友首单奖励${points}积分`,
          );
          this.logger.log(`邀请人首单积分奖励：inviter=${inviterUserId}, points=${points}`);
        }
      }
    }

    if (campaign.rewardType === 'coupon' || campaign.rewardType === 'both') {
      const couponId = inviterConfig.couponId;
      if (couponId) {
        try {
          await this.couponService.receive(inviterUserId, couponId);
          this.logger.log(`邀请人首单优惠券奖励：inviter=${inviterUserId}, couponId=${couponId}`);
        } catch {}
      }
    }
  }

  async getMyStats(userId: string) {
    const [inviteCount, rewardPoints, recentInvites] = await Promise.all([
      this.prisma.userInviteRelation.count({
        where: { inviterUserId: BigInt(userId) },
      }),
      this.prisma.pointsRecord.findMany({
        where: {
          userId: BigInt(userId),
          source: { in: ['share', 'inviter_first_paid'] },
          type: 1,
        },
        select: { points: true },
      }),
      this.prisma.userInviteRelation.findMany({
        where: { inviterUserId: BigInt(userId) },
        include: {
          invitee: { select: { id: true, nickname: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    const totalRewardPoints = rewardPoints.reduce((sum, r) => sum + r.points, 0);

    return {
      inviteCount,
      totalRewardPoints,
      recentInvites: recentInvites.map((r) => ({
        ...r,
        id: r.id.toString(),
        inviterUserId: r.inviterUserId.toString(),
        inviteeUserId: r.inviteeUserId.toString(),
        sourceShareRecordId: r.sourceShareRecordId?.toString(),
        sourceCampaignId: r.sourceCampaignId?.toString(),
        firstPaidOrderId: r.firstPaidOrderId?.toString(),
        invitee: r.invitee ? {
          ...r.invitee,
          id: r.invitee.id.toString(),
        } : null,
      })),
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
        posterData.product = { ...product, id: product.id.toString() };
        posterData.shareUrl = `/pages/product/detail?id=${product.id}&inviter=${userId}`;
      }
    } else if (type === 'activity' && targetId) {
      const activity = await this.prisma.activity.findFirst({
        where: { id: BigInt(targetId), status: 2 },
        select: { id: true, name: true, bannerImage: true },
      });
      if (activity) {
        posterData.activity = { ...activity, id: activity.id.toString() };
        posterData.shareUrl = `/pages/activity/detail?id=${activity.id}&inviter=${userId}`;
      }
    } else if (type === 'content' && targetId) {
      const content = await this.prisma.content.findFirst({
        where: { id: BigInt(targetId), status: 1 },
        select: { id: true, title: true, coverImage: true },
      });
      if (content) {
        posterData.content = { ...content, id: content.id.toString() };
        posterData.shareUrl = `/pages/content/detail?id=${content.id}&inviter=${userId}`;
      }
    } else if (type === 'invite') {
      const user = await this.prisma.user.findFirst({
        where: { id: BigInt(userId) },
        select: { id: true, nickname: true, avatarUrl: true },
      });
      if (user) {
        posterData.inviter = { ...user, id: user.id.toString() };
        posterData.shareUrl = `/pages/share/invite?inviter=${user.id}`;
      }
    } else if (type === 'home') {
      posterData.shareUrl = `/pages/home/index?inviter=${userId}`;
    }

    return posterData;
  }

  async findAllCampaigns(page: number = 1, pageSize: number = 10) {
    const [list, total] = await Promise.all([
      this.prisma.shareCampaign.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.shareCampaign.count(),
    ]);

    return {
      list: list.map((c) => ({ ...c, id: c.id.toString() })),
      total,
      page,
      pageSize,
    };
  }

  async createCampaign(data: any) {
    const campaign = await this.prisma.shareCampaign.create({
      data: {
        name: data.name,
        type: data.type,
        rewardType: data.rewardType,
        inviterRewardConfig: data.inviterRewardConfig || null,
        inviteeRewardConfig: data.inviteeRewardConfig || null,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
        status: data.status ?? 1,
      },
    });
    this.logger.log(`创建裂变活动：${campaign.id}`);
    return { ...campaign, id: campaign.id.toString() };
  }

  async updateCampaign(id: string, data: any) {
    const campaign = await this.prisma.shareCampaign.findFirst({ where: { id: BigInt(id) } });
    if (!campaign) throw new NotFoundException('活动不存在');

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.rewardType !== undefined) updateData.rewardType = data.rewardType;
    if (data.inviterRewardConfig !== undefined) updateData.inviterRewardConfig = data.inviterRewardConfig;
    if (data.inviteeRewardConfig !== undefined) updateData.inviteeRewardConfig = data.inviteeRewardConfig;
    if (data.startTime !== undefined) updateData.startTime = new Date(data.startTime);
    if (data.endTime !== undefined) updateData.endTime = new Date(data.endTime);

    const result = await this.prisma.shareCampaign.update({
      where: { id: BigInt(id) },
      data: updateData,
    });
    return { ...result, id: result.id.toString() };
  }

  async updateCampaignStatus(id: string, status: number) {
    const campaign = await this.prisma.shareCampaign.findFirst({ where: { id: BigInt(id) } });
    if (!campaign) throw new NotFoundException('活动不存在');

    const result = await this.prisma.shareCampaign.update({
      where: { id: BigInt(id) },
      data: { status },
    });
    return { ...result, id: result.id.toString() };
  }

  async findShareRecords(page: number = 1, pageSize: number = 10) {
    const [list, total] = await Promise.all([
      this.prisma.shareRecord.findMany({
        include: { user: { select: { id: true, nickname: true, avatarUrl: true } } },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.shareRecord.count(),
    ]);

    return {
      list: list.map((r) => ({
        ...r,
        id: r.id.toString(),
        userId: r.userId.toString(),
        shareId: r.shareId?.toString(),
        campaignId: r.campaignId?.toString(),
        inviterUserId: r.inviterUserId?.toString(),
        user: r.user ? { ...r.user, id: r.user.id.toString() } : null,
      })),
      total,
      page,
      pageSize,
    };
  }

  async findInviteRelations(page: number = 1, pageSize: number = 10) {
    const [list, total] = await Promise.all([
      this.prisma.userInviteRelation.findMany({
        include: {
          inviter: { select: { id: true, nickname: true, avatarUrl: true } },
          invitee: { select: { id: true, nickname: true, avatarUrl: true } },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.userInviteRelation.count(),
    ]);

    return {
      list: list.map((r) => ({
        ...r,
        id: r.id.toString(),
        inviterUserId: r.inviterUserId.toString(),
        inviteeUserId: r.inviteeUserId.toString(),
        sourceShareRecordId: r.sourceShareRecordId?.toString(),
        sourceCampaignId: r.sourceCampaignId?.toString(),
        firstPaidOrderId: r.firstPaidOrderId?.toString(),
        inviter: r.inviter ? { ...r.inviter, id: r.inviter.id.toString() } : null,
        invitee: r.invitee ? { ...r.invitee, id: r.invitee.id.toString() } : null,
      })),
      total,
      page,
      pageSize,
    };
  }

  async getShareStats() {
    const [totalShares, totalClicks, totalRegisters, totalInviteRelations, totalPaidOrders] = await Promise.all([
      this.prisma.shareRecord.count(),
      this.prisma.shareRecord.aggregate({ _sum: { clickCount: true } }),
      this.prisma.shareRecord.aggregate({ _sum: { registerCount: true } }),
      this.prisma.userInviteRelation.count(),
      this.prisma.userInviteRelation.count({ where: { firstPaidOrderId: { not: null } } }),
    ]);

    return {
      totalShares,
      totalClicks: totalClicks._sum.clickCount || 0,
      totalRegisters: totalRegisters._sum.registerCount || 0,
      totalInviteRelations,
      totalPaidOrders,
    };
  }

  private generateSceneCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
}
