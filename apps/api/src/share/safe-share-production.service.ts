import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { POINTS_EXPIRE_MONTHS } from '@baby-mall/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { CouponService } from '../coupon/coupon.service';
import { PointsService } from '../points/points.service';
import { SystemConfigService } from '../system-config/system-config.service';
import { DurableRewardProductionShareService } from './durable-reward-production-share.service';

const POSTER_TYPES = new Set(['product', 'activity', 'content', 'invite', 'home']);
const REGISTER_REWARD_SOURCE = 'invitee_register';
const REGISTER_COMPLETE_SOURCE = 'invitee_register_complete';

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

  override async bindInvite(
    userId: string,
    data: { inviter?: string; shareRecordId?: string; campaignId?: string },
  ) {
    const inviteeUserId = parsePositiveBigIntId(userId, '被邀请用户');
    const explicitInviterId = data.inviter
      ? parsePositiveBigIntId(data.inviter, '邀请人')
      : null;
    const requestedShareRecordId = data.shareRecordId
      ? parsePositiveBigIntId(data.shareRecordId, '分享记录')
      : null;
    const requestedCampaignId = data.campaignId
      ? parsePositiveBigIntId(data.campaignId, '裂变活动')
      : null;

    if (explicitInviterId === inviteeUserId) {
      throw new BadRequestException('不能邀请自己');
    }

    try {
      return await this.safeSharePrisma.$transaction(async (tx) => {
        const existing = await tx.userInviteRelation.findUnique({
          where: { inviteeUserId },
        });
        if (existing) {
          await this.issueInviteeRegistrationRewards(tx, existing, false);
          return { bound: false, reason: 'already_invited' };
        }

        const shareRecord = requestedShareRecordId
          ? await tx.shareRecord.findUnique({ where: { id: requestedShareRecordId } })
          : null;
        if (requestedShareRecordId && !shareRecord) {
          throw new NotFoundException('分享记录不存在');
        }

        const shareInviterId = shareRecord
          ? (shareRecord.inviterUserId || shareRecord.userId)
          : null;
        if (shareInviterId && explicitInviterId && shareInviterId !== explicitInviterId) {
          throw new BadRequestException('分享记录与邀请人不匹配');
        }
        const inviterUserId = shareInviterId || explicitInviterId;
        if (!inviterUserId) {
          return { bound: false, reason: 'no_inviter' };
        }
        if (inviterUserId === inviteeUserId) {
          throw new BadRequestException('不能邀请自己');
        }

        const shareCampaignId = shareRecord?.campaignId ?? null;
        if (shareCampaignId && requestedCampaignId && shareCampaignId !== requestedCampaignId) {
          throw new BadRequestException('分享记录与裂变活动不匹配');
        }
        const sourceCampaignId = shareCampaignId || requestedCampaignId;

        const inviter = await tx.user.findFirst({
          where: { id: inviterUserId, deletedAt: null, status: 1 },
          select: { id: true },
        });
        if (!inviter) throw new NotFoundException('邀请人不存在或已停用');

        const invitee = await tx.user.findFirst({
          where: { id: inviteeUserId, deletedAt: null, status: 1 },
          select: { id: true },
        });
        if (!invitee) throw new NotFoundException('被邀请用户不存在或已停用');

        if (sourceCampaignId) {
          const campaign = await tx.shareCampaign.findUnique({
            where: { id: sourceCampaignId },
          });
          if (!campaign) throw new NotFoundException('裂变活动不存在');
        }

        const registeredAt = new Date();
        const relation = await tx.userInviteRelation.create({
          data: {
            inviterUserId,
            inviteeUserId,
            sourceShareRecordId: requestedShareRecordId,
            sourceCampaignId,
            registeredAt,
            status: 1,
          },
        });

        if (requestedShareRecordId) {
          await tx.shareRecord.update({
            where: { id: requestedShareRecordId },
            data: { registerCount: { increment: 1 } },
          });
        }

        await this.issueInviteeRegistrationRewards(tx, relation, true);
        return {
          bound: true,
          relationId: relation.id.toString(),
        };
      });
    } catch (error: any) {
      if (error?.code !== 'P2002') throw error;

      // A concurrent request may have won the unique invitee relation race. Re-open a transaction
      // and reconcile its registration reward so the loser does not simply return success while
      // leaving a partially issued reward behind.
      return this.safeSharePrisma.$transaction(async (tx) => {
        const existing = await tx.userInviteRelation.findUnique({ where: { inviteeUserId } });
        if (!existing) throw error;
        await this.issueInviteeRegistrationRewards(tx, existing, false);
        return { bound: false, reason: 'already_invited' };
      });
    }
  }

  override async createCampaign(data: any) {
    await this.assertInviteeRewardConfiguration(data);
    return super.createCampaign(data);
  }

  override async updateCampaign(id: string, data: any) {
    const campaignId = parsePositiveBigIntId(id, '裂变活动');
    const current = await this.safeSharePrisma.shareCampaign.findUnique({ where: { id: campaignId } });
    if (!current) throw new NotFoundException('活动不存在');
    await this.assertInviteeRewardConfiguration({ ...current, ...data });
    return super.updateCampaign(id, data);
  }

  override async updateCampaignStatus(id: string, status: number) {
    const campaignId = parsePositiveBigIntId(id, '裂变活动');
    if (status === 1) {
      const current = await this.safeSharePrisma.shareCampaign.findUnique({ where: { id: campaignId } });
      if (!current) throw new NotFoundException('活动不存在');
      await this.assertInviteeRewardConfiguration(current);
    }
    return super.updateCampaignStatus(id, status);
  }

  override async reconcileMatureFirstPaidRewards(limit = 200) {
    const registration = await this.reconcileInviteeRegistrationRewards(limit);
    const firstPaid = await super.reconcileMatureFirstPaidRewards(limit);
    return {
      ...firstPaid,
      issued: firstPaid.issued + registration.issued,
      failed: firstPaid.failed + registration.failed,
      registration,
    };
  }

  async reconcileInviteeRegistrationRewards(limit = 200) {
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 1000);
    const candidates = await this.safeSharePrisma.$queryRaw<Array<{ relationId: bigint }>>`
      SELECT r.id AS relationId
      FROM user_invite_relations r
      INNER JOIN share_campaigns c ON c.id = r.source_campaign_id
      WHERE r.status = 1
        AND r.source_campaign_id IS NOT NULL
        AND r.registered_at IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM user_invite_rewards marker
          WHERE marker.dedupe_key = CONCAT('register:complete:', r.id)
            AND marker.deleted_at IS NULL
        )
      ORDER BY r.id ASC
      LIMIT ${safeLimit}
    `;

    let issued = 0;
    let completed = 0;
    let failed = 0;
    for (const candidate of candidates) {
      try {
        const result = await this.safeSharePrisma.$transaction(async (tx) => {
          const relation = await tx.userInviteRelation.findUnique({
            where: { id: candidate.relationId },
          });
          if (!relation) return { issued: 0, completed: false };
          return this.issueInviteeRegistrationRewards(tx, relation, false);
        });
        issued += result.issued;
        if (result.completed) completed += 1;
      } catch {
        failed += 1;
      }
    }
    return { total: candidates.length, issued, completed, failed };
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
      if (!activity) throw new NotFoundException('活动不存在或未进行中');
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

  private async assertInviteeRewardConfiguration(data: any) {
    const rewardType = String(data.rewardType || '');
    const config: any = data.inviteeRewardConfig || {};

    if (rewardType === 'points' || rewardType === 'both') {
      const points = Number(config.points || 0);
      if (config.points !== undefined && config.points !== null && config.points !== '') {
        if (!Number.isSafeInteger(points) || points <= 0) {
          throw new BadRequestException('被邀请人注册积分奖励必须为正整数');
        }
      }
    }

    if (rewardType === 'coupon' || rewardType === 'both') {
      const rawCouponId = config.couponId;
      if (rawCouponId !== undefined && rawCouponId !== null && rawCouponId !== '') {
        const couponId = parsePositiveBigIntId(rawCouponId, '被邀请人注册奖励优惠券');
        const coupon = await this.safeSharePrisma.coupon.findUnique({ where: { id: couponId } });
        if (!coupon) throw new BadRequestException('被邀请人注册奖励优惠券不存在');
        if (coupon.status !== 1) throw new BadRequestException('被邀请人注册奖励优惠券必须处于可领取状态');

        const campaignStart = new Date(data.startTime);
        const campaignEnd = new Date(data.endTime);
        if (
          !Number.isNaN(campaignStart.getTime()) &&
          !Number.isNaN(campaignEnd.getTime()) &&
          (coupon.startTime > campaignStart || coupon.endTime < campaignEnd)
        ) {
          throw new BadRequestException('被邀请人注册奖励优惠券的领取时间必须完整覆盖裂变活动时间');
        }
      }
    }
  }

  private async issueInviteeRegistrationRewards(
    tx: any,
    relation: any,
    requireCurrentlyActive: boolean,
  ): Promise<{ issued: number; completed: boolean }> {
    if (!relation.sourceCampaignId) return { issued: 0, completed: false };

    const completeKey = `register:complete:${relation.id}`;
    const complete = await tx.userInviteReward.findUnique({ where: { dedupeKey: completeKey } });
    if (complete) return { issued: 0, completed: true };

    const campaign = await tx.shareCampaign.findUnique({ where: { id: relation.sourceCampaignId } });
    if (!campaign) throw new NotFoundException('裂变活动不存在');

    const registeredAt = relation.registeredAt || relation.createdAt || new Date();
    const inWindow = registeredAt >= campaign.startTime && registeredAt <= campaign.endTime;
    if (requireCurrentlyActive && (campaign.status !== 1 || !inWindow)) {
      await this.markRegistrationComplete(tx, relation, '绑定时裂变活动未处于有效奖励期');
      return { issued: 0, completed: true };
    }
    if (!inWindow) {
      await this.markRegistrationComplete(tx, relation, '注册时间不在裂变活动奖励期');
      return { issued: 0, completed: true };
    }

    const config: any = campaign.inviteeRewardConfig || {};
    let issued = 0;

    if (campaign.rewardType === 'points' || campaign.rewardType === 'both') {
      const points = Number(config.points || 0);
      if (points > 0) {
        if (!Number.isSafeInteger(points)) throw new BadRequestException('被邀请人注册积分奖励配置无效');
        issued += await this.issueRegistrationPoints(tx, relation, points);
      }
    }

    if (campaign.rewardType === 'coupon' || campaign.rewardType === 'both') {
      const rawCouponId = config.couponId;
      if (rawCouponId !== undefined && rawCouponId !== null && rawCouponId !== '') {
        const couponId = parsePositiveBigIntId(rawCouponId, '被邀请人注册奖励优惠券');
        issued += await this.issueRegistrationCoupon(tx, relation, couponId);
      }
    }

    await this.markRegistrationComplete(tx, relation, '被邀请人注册奖励已完成幂等核对');
    return { issued, completed: true };
  }

  private async issueRegistrationPoints(tx: any, relation: any, points: number) {
    const dedupeKey = `register:points:${relation.id}`;
    const existing = await tx.userInviteReward.findUnique({ where: { dedupeKey } });
    if (existing) return 0;

    const userRows = await tx.$queryRaw<Array<{ id: bigint; availablePoints: number }>>`
      SELECT id, available_points AS availablePoints
      FROM users
      WHERE id = ${relation.inviteeUserId} AND deleted_at IS NULL AND status = 1
      FOR UPDATE
    `;
    const user = userRows[0];
    if (!user) throw new NotFoundException('被邀请用户不存在或已停用');

    const expireAt = new Date();
    expireAt.setMonth(expireAt.getMonth() + POINTS_EXPIRE_MONTHS);
    expireAt.setDate(expireAt.getDate() - 1);
    expireAt.setHours(23, 59, 59, 0);

    await tx.user.update({
      where: { id: relation.inviteeUserId },
      data: {
        totalPoints: { increment: points },
        availablePoints: { increment: points },
      },
    });
    await tx.pointsRecord.create({
      data: {
        userId: relation.inviteeUserId,
        type: 1,
        points,
        balance: user.availablePoints + points,
        source: REGISTER_REWARD_SOURCE,
        sourceId: relation.id,
        description: `被邀请注册奖励${points}积分`,
        expireAt,
      },
    });
    await tx.userInviteReward.create({
      data: {
        userId: relation.inviteeUserId,
        inviteeUserId: relation.inviteeUserId,
        campaignId: relation.sourceCampaignId,
        rewardType: 'points',
        rewardName: `注册奖励${points}积分`,
        points,
        status: 'issued',
        sourceType: REGISTER_REWARD_SOURCE,
        sourceId: relation.id,
        dedupeKey,
        issuedAt: new Date(),
      },
    });
    return 1;
  }

  private async issueRegistrationCoupon(tx: any, relation: any, couponId: bigint) {
    const dedupeKey = `register:coupon:${relation.id}:${couponId}`;
    const existing = await tx.userInviteReward.findUnique({ where: { dedupeKey } });
    if (existing) return 0;

    await tx.$queryRaw`SELECT id FROM coupons WHERE id = ${couponId} FOR UPDATE`;
    const coupon = await tx.coupon.findUnique({ where: { id: couponId } });
    if (!coupon) throw new NotFoundException('被邀请人注册奖励优惠券不存在');

    const now = new Date();
    if (coupon.status !== 1) throw new BadRequestException('被邀请人注册奖励优惠券已停止发放');
    if (now < coupon.startTime || now > coupon.endTime) {
      throw new BadRequestException('被邀请人注册奖励优惠券当前不在领取期');
    }

    const user = await tx.user.findUnique({
      where: { id: relation.inviteeUserId },
      select: { id: true, memberLevelId: true, deletedAt: true, status: true },
    });
    if (!user || user.deletedAt || user.status !== 1) {
      throw new NotFoundException('被邀请用户不存在或已停用');
    }
    if (coupon.memberLevelId && coupon.memberLevelId !== user.memberLevelId) {
      throw new BadRequestException('被邀请用户会员等级不满足奖励优惠券领取条件');
    }
    if (coupon.isNewUser === 1) {
      const paidOrders = await tx.order.count({
        where: {
          userId: relation.inviteeUserId,
          status: { notIn: ['pending_payment', 'cancelled'] },
        },
      });
      if (paidOrders > 0) throw new BadRequestException('该注册奖励优惠券仅限新用户');
    }

    const receivedCount = await tx.userCoupon.count({
      where: { userId: relation.inviteeUserId, couponId },
    });
    if (receivedCount >= coupon.perLimit) {
      throw new BadRequestException(`奖励优惠券每人最多持有${coupon.perLimit}张`);
    }

    if (coupon.totalCount > 0) {
      const inventory = await tx.coupon.updateMany({
        where: { id: couponId, receivedCount: { lt: coupon.totalCount } },
        data: { receivedCount: { increment: 1 } },
      });
      if (inventory.count !== 1) throw new BadRequestException('被邀请人注册奖励优惠券已领完');
    } else {
      await tx.coupon.update({
        where: { id: couponId },
        data: { receivedCount: { increment: 1 } },
      });
    }

    const expireAt = coupon.validDays > 0
      ? new Date(now.getTime() + coupon.validDays * 24 * 60 * 60 * 1000)
      : coupon.endTime;
    if (expireAt.getTime() <= now.getTime()) {
      throw new BadRequestException('被邀请人注册奖励优惠券已无法形成有效持券期限');
    }

    await tx.userCoupon.create({
      data: {
        userId: relation.inviteeUserId,
        couponId,
        status: 1,
        expireAt,
      },
    });
    await tx.userInviteReward.create({
      data: {
        userId: relation.inviteeUserId,
        inviteeUserId: relation.inviteeUserId,
        campaignId: relation.sourceCampaignId,
        rewardType: 'coupon',
        rewardName: '注册优惠券奖励',
        couponId,
        status: 'issued',
        sourceType: REGISTER_REWARD_SOURCE,
        sourceId: relation.id,
        dedupeKey,
        issuedAt: now,
      },
    });
    return 1;
  }

  private async markRegistrationComplete(tx: any, relation: any, rewardName: string) {
    await tx.userInviteReward.createMany({
      data: [{
        userId: relation.inviteeUserId,
        inviteeUserId: relation.inviteeUserId,
        campaignId: relation.sourceCampaignId,
        rewardType: 'reconcile_marker',
        rewardName,
        status: 'issued',
        sourceType: REGISTER_COMPLETE_SOURCE,
        sourceId: relation.id,
        dedupeKey: `register:complete:${relation.id}`,
        issuedAt: new Date(),
      }],
      skipDuplicates: true,
    });
  }
}
