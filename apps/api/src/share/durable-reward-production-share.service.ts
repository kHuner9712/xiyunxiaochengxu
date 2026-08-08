import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { POINTS_EXPIRE_MONTHS } from '@baby-mall/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { CouponService } from '../coupon/coupon.service';
import { PointsService } from '../points/points.service';
import { SystemConfigService } from '../system-config/system-config.service';
import { ProductionShareService } from './production-share.service';

const FIRST_PAID_SOURCE = 'first_paid_order';
const FIRST_PAID_PENDING = 'pending';
const FIRST_PAID_ISSUED = 'issued';
const FIRST_PAID_CANCELLED = 'cancelled';

@Injectable()
export class DurableRewardProductionShareService extends ProductionShareService {
  private readonly durableLogger = new Logger(DurableRewardProductionShareService.name);

  constructor(
    private readonly durablePrisma: PrismaService,
    private readonly durableRedis: RedisService,
    pointsService: PointsService,
    couponService: CouponService,
    private readonly systemConfigService: SystemConfigService,
  ) {
    super(durablePrisma, durableRedis, pointsService, couponService);
  }

  override async processFirstPaidReward(
    inviteeUserId: string,
    orderId: string,
    paidAmount: number,
  ) {
    const inviteeId = parsePositiveBigIntId(inviteeUserId, '被邀请用户');
    const orderIdValue = parsePositiveBigIntId(orderId, '首单');
    if (!Number.isSafeInteger(paidAmount) || paidAmount < 0) {
      throw new BadRequestException('首单实付金额无效');
    }

    const relation = await this.durablePrisma.userInviteRelation.findFirst({
      where: { inviteeUserId: inviteeId, status: 1 },
    });
    if (!relation) return;

    const lockKey = `share:first-paid:${relation.id}`;
    const lockValue = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const locked = await this.durableRedis.setNX(lockKey, lockValue, 120);
    if (!locked) return;

    try {
      const order = await this.durablePrisma.order.findUnique({
        where: { id: orderIdValue },
        select: { id: true, userId: true, paidAt: true, payAmount: true, status: true },
      });
      if (!order || order.userId !== inviteeId || !order.paidAt) return;
      const paidAt = order.paidAt;

      await this.durablePrisma.$transaction(async (tx) => {
        const current = await tx.userInviteRelation.findUnique({ where: { id: relation.id } });
        if (!current || current.status !== 1) return;
        if (current.firstPaidOrderId && current.firstPaidOrderId !== orderIdValue) return;

        if (!current.firstPaidOrderId) {
          const claimed = await tx.userInviteRelation.updateMany({
            where: { id: current.id, status: 1, firstPaidOrderId: null },
            data: { firstPaidOrderId: orderIdValue, firstPaidAt: paidAt },
          });
          if (claimed.count !== 1) {
            const refreshed = await tx.userInviteRelation.findUnique({ where: { id: current.id } });
            if (refreshed?.firstPaidOrderId !== orderIdValue) return;
          }
        }

        const attribution = await tx.userInviteReward.createMany({
          data: [{
            userId: current.inviterUserId,
            inviteeUserId: current.inviteeUserId,
            campaignId: current.sourceCampaignId,
            rewardType: 'attribution',
            rewardName: '首单归因',
            status: FIRST_PAID_ISSUED,
            sourceType: 'first_paid_attribution',
            sourceId: orderIdValue,
            dedupeKey: `first_paid:attribution:${orderIdValue}`,
            issuedAt: paidAt,
          }],
          skipDuplicates: true,
        });
        if (attribution.count === 1 && current.sourceShareRecordId) {
          await tx.shareRecord.update({
            where: { id: current.sourceShareRecordId },
            data: {
              orderCount: { increment: 1 },
              paidOrderAmount: { increment: paidAmount },
            },
          });
        }

        await this.snapshotEarnedRewards(tx, current, orderIdValue, paidAt, true);
      });
    } finally {
      await this.durableRedis.releaseLockWithLua(lockKey, lockValue);
    }
  }

  override async reconcileMatureFirstPaidRewards(limit = 200) {
    await this.reconcileSuccessfulRefundAttributions(limit);

    const aftersaleDays = this.systemConfigService.getRuntimeConfig().aftersaleApplyDays;
    const cutoff = new Date(Date.now() - aftersaleDays * 24 * 60 * 60 * 1000);
    const candidateRows = await this.durablePrisma.$queryRaw<Array<{ relationId: bigint }>>`
      SELECT r.id AS relationId
      FROM user_invite_relations r
      INNER JOIN orders o ON o.id = r.first_paid_order_id
      WHERE r.status = 1
        AND r.first_paid_order_id IS NOT NULL
        AND o.status = 'completed'
        AND o.completed_at IS NOT NULL
        AND o.completed_at <= ${cutoff}
        AND NOT EXISTS (
          SELECT 1
          FROM user_invite_rewards marker
          WHERE marker.dedupe_key = CONCAT('first_paid:complete:', r.first_paid_order_id)
            AND marker.deleted_at IS NULL
        )
      ORDER BY COALESCE(r.first_paid_at, r.created_at) ASC
      LIMIT ${limit}
    `;

    let issued = 0;
    let skipped = 0;
    let failed = 0;
    for (const candidate of candidateRows) {
      try {
        const relation = await this.durablePrisma.userInviteRelation.findUnique({
          where: { id: candidate.relationId },
        });
        if (!relation?.firstPaidOrderId) {
          skipped += 1;
          continue;
        }
        const order = await this.durablePrisma.order.findUnique({
          where: { id: relation.firstPaidOrderId },
          select: { id: true, status: true, paidAt: true, completedAt: true, payAmount: true },
        });
        if (!order?.completedAt || !order.paidAt || order.status !== 'completed' || order.completedAt > cutoff) {
          skipped += 1;
          continue;
        }

        const refundSummary = await this.durablePrisma.orderRefund.aggregate({
          where: { orderId: order.id, status: 'success' },
          _sum: { refundAmount: true },
        });
        const grossPaid = Math.max(0, order.payAmount ?? 0);
        const refundedAmount = Math.min(grossPaid, Math.max(0, refundSummary._sum.refundAmount ?? 0));
        const netPaidAmount = Math.max(0, grossPaid - refundedAmount);

        if (netPaidAmount <= 0) {
          await this.cancelPendingRewardsAndComplete(relation, order.id, '订单已全额退款，无成熟首单奖励');
          skipped += 1;
          continue;
        }

        await this.ensureLegacyRewardSnapshot(relation, order.id, order.paidAt);
        const before = await this.durablePrisma.userInviteReward.count({
          where: { sourceType: FIRST_PAID_SOURCE, sourceId: order.id, status: FIRST_PAID_ISSUED },
        });
        await this.settlePendingRewards(relation, order.id);
        const after = await this.durablePrisma.userInviteReward.count({
          where: { sourceType: FIRST_PAID_SOURCE, sourceId: order.id, status: FIRST_PAID_ISSUED },
        });
        await this.markComplete(relation, order.id, '成熟首单奖励已完成幂等核对');
        if (after > before) issued += 1;
        else skipped += 1;
      } catch (error) {
        failed += 1;
        this.durableLogger.error(
          `首单奖励补偿失败: relationId=${candidate.relationId}, error=${(error as Error).message}`,
        );
      }
    }
    return { total: candidateRows.length, issued, skipped, failed, aftersaleDays };
  }

  override async createCampaign(data: any) {
    await this.assertCampaignRewardConfiguration(data);
    return super.createCampaign(data);
  }

  override async updateCampaign(id: string, data: any) {
    const campaignId = parsePositiveBigIntId(id, '裂变活动');
    const current = await this.durablePrisma.shareCampaign.findUnique({ where: { id: campaignId } });
    if (!current) throw new NotFoundException('活动不存在');
    await this.assertCampaignRewardConfiguration({ ...current, ...data });
    return super.updateCampaign(id, data);
  }

  private async snapshotEarnedRewards(
    tx: any,
    relation: any,
    orderId: bigint,
    paidAt: Date,
    requireCampaignActive: boolean,
  ) {
    if (!relation.sourceCampaignId) return;
    const campaign = await tx.shareCampaign.findUnique({ where: { id: relation.sourceCampaignId } });
    if (!campaign) return;
    if (requireCampaignActive && campaign.status !== 1) return;
    if (paidAt < campaign.startTime || paidAt > campaign.endTime) return;

    const inviterConfig: any = campaign.inviterRewardConfig;
    if (!inviterConfig) return;

    if (campaign.rewardType === 'points' || campaign.rewardType === 'both') {
      const points = Number(inviterConfig.points || 0);
      if (Number.isSafeInteger(points) && points > 0) {
        await tx.userInviteReward.createMany({
          data: [{
            userId: relation.inviterUserId,
            inviteeUserId: relation.inviteeUserId,
            campaignId: relation.sourceCampaignId,
            rewardType: 'points',
            rewardName: `邀请好友首单奖励${points}积分`,
            points,
            status: FIRST_PAID_PENDING,
            sourceType: FIRST_PAID_SOURCE,
            sourceId: orderId,
            dedupeKey: `first_paid:points:${orderId}`,
          }],
          skipDuplicates: true,
        });
      }
    }

    if (campaign.rewardType === 'coupon' || campaign.rewardType === 'both') {
      const rawCouponId = inviterConfig.couponId;
      if (rawCouponId !== undefined && rawCouponId !== null && rawCouponId !== '') {
        const couponId = parsePositiveBigIntId(rawCouponId, '邀请奖励优惠券');
        const coupon = await tx.coupon.findUnique({ where: { id: couponId } });
        if (!coupon) throw new BadRequestException('邀请奖励优惠券不存在');
        await tx.userInviteReward.createMany({
          data: [{
            userId: relation.inviterUserId,
            inviteeUserId: relation.inviteeUserId,
            campaignId: relation.sourceCampaignId,
            rewardType: 'coupon',
            rewardName: '邀请好友首单优惠券奖励',
            couponId,
            status: FIRST_PAID_PENDING,
            sourceType: FIRST_PAID_SOURCE,
            sourceId: orderId,
            dedupeKey: `first_paid:coupon:${orderId}:${couponId}`,
          }],
          skipDuplicates: true,
        });
      }
    }
  }

  private async ensureLegacyRewardSnapshot(relation: any, orderId: bigint, paidAt: Date) {
    const existing = await this.durablePrisma.userInviteReward.count({
      where: { sourceType: FIRST_PAID_SOURCE, sourceId: orderId, deletedAt: null },
    });
    if (existing > 0) return;
    await this.durablePrisma.$transaction(async (tx) => {
      await this.snapshotEarnedRewards(tx, relation, orderId, paidAt, false);
    });
  }

  private async settlePendingRewards(relation: any, orderId: bigint) {
    const pending = await this.durablePrisma.userInviteReward.findMany({
      where: {
        userId: relation.inviterUserId,
        sourceType: FIRST_PAID_SOURCE,
        sourceId: orderId,
        status: FIRST_PAID_PENDING,
        deletedAt: null,
      },
      orderBy: { id: 'asc' },
    });
    for (const reward of pending) {
      if (reward.rewardType === 'points') {
        await this.settlePointsReward(reward);
      } else if (reward.rewardType === 'coupon') {
        await this.settleCouponReward(reward);
      } else {
        throw new BadRequestException(`不支持的首单奖励类型: ${reward.rewardType}`);
      }
    }
  }

  private async settlePointsReward(reward: any) {
    const points = Number(reward.points || 0);
    if (!Number.isSafeInteger(points) || points <= 0) {
      throw new BadRequestException('首单积分奖励配置无效');
    }
    await this.durablePrisma.$transaction(async (tx) => {
      const claim = await tx.userInviteReward.updateMany({
        where: { id: reward.id, status: FIRST_PAID_PENDING, deletedAt: null },
        data: { status: 'issuing' },
      });
      if (claim.count !== 1) return;

      const rows = await tx.$queryRaw<Array<{ id: bigint; availablePoints: number }>>`
        SELECT id, available_points AS availablePoints
        FROM users WHERE id = ${reward.userId} AND deleted_at IS NULL FOR UPDATE
      `;
      const user = rows[0];
      if (!user) throw new NotFoundException('邀请人不存在，无法发放首单积分奖励');

      const expireAt = new Date();
      expireAt.setMonth(expireAt.getMonth() + POINTS_EXPIRE_MONTHS);
      expireAt.setDate(expireAt.getDate() - 1);
      expireAt.setHours(23, 59, 59, 0);

      await tx.user.update({
        where: { id: reward.userId },
        data: {
          totalPoints: { increment: points },
          availablePoints: { increment: points },
        },
      });
      await tx.pointsRecord.create({
        data: {
          userId: reward.userId,
          type: 1,
          points,
          balance: user.availablePoints + points,
          source: 'inviter_first_paid',
          sourceId: reward.sourceId,
          description: `邀请好友首单奖励${points}积分`,
          expireAt,
        },
      });
      await tx.userInviteReward.update({
        where: { id: reward.id },
        data: { status: FIRST_PAID_ISSUED, issuedAt: new Date() },
      });
    });
  }

  private async settleCouponReward(reward: any) {
    if (!reward.couponId) throw new BadRequestException('首单优惠券奖励缺少优惠券');
    await this.durablePrisma.$transaction(async (tx) => {
      const claim = await tx.userInviteReward.updateMany({
        where: { id: reward.id, status: FIRST_PAID_PENDING, deletedAt: null },
        data: { status: 'issuing' },
      });
      if (claim.count !== 1) return;

      const coupon = await tx.coupon.findUnique({ where: { id: reward.couponId } });
      if (!coupon) throw new NotFoundException('邀请奖励优惠券不存在');
      const now = new Date();
      const expireAt = coupon.validDays > 0
        ? new Date(now.getTime() + coupon.validDays * 24 * 60 * 60 * 1000)
        : coupon.endTime;
      if (expireAt.getTime() <= now.getTime()) {
        throw new BadRequestException('邀请奖励优惠券已无法形成有效持券期限，请更换为领取后滚动有效的奖励券');
      }

      if (coupon.totalCount > 0) {
        const inventory = await tx.coupon.updateMany({
          where: { id: coupon.id, receivedCount: { lt: coupon.totalCount } },
          data: { receivedCount: { increment: 1 } },
        });
        if (inventory.count !== 1) throw new BadRequestException('邀请奖励优惠券库存不足');
      } else {
        await tx.coupon.update({
          where: { id: coupon.id },
          data: { receivedCount: { increment: 1 } },
        });
      }

      await tx.userCoupon.create({
        data: {
          userId: reward.userId,
          couponId: coupon.id,
          status: 1,
          expireAt,
        },
      });
      await tx.userInviteReward.update({
        where: { id: reward.id },
        data: { status: FIRST_PAID_ISSUED, issuedAt: now },
      });
    });
  }

  private async cancelPendingRewardsAndComplete(relation: any, orderId: bigint, reason: string) {
    await this.durablePrisma.$transaction(async (tx) => {
      await tx.userInviteReward.updateMany({
        where: {
          sourceType: FIRST_PAID_SOURCE,
          sourceId: orderId,
          status: FIRST_PAID_PENDING,
          deletedAt: null,
        },
        data: { status: FIRST_PAID_CANCELLED },
      });
      await tx.userInviteReward.createMany({
        data: [{
          userId: relation.inviterUserId,
          inviteeUserId: relation.inviteeUserId,
          campaignId: relation.sourceCampaignId,
          rewardType: 'reconcile_marker',
          rewardName: reason,
          status: FIRST_PAID_ISSUED,
          sourceType: 'first_paid_reconcile_complete',
          sourceId: orderId,
          dedupeKey: `first_paid:complete:${orderId}`,
          issuedAt: new Date(),
        }],
        skipDuplicates: true,
      });
    });
  }

  private async markComplete(relation: any, orderId: bigint, reason: string) {
    await this.durablePrisma.userInviteReward.createMany({
      data: [{
        userId: relation.inviterUserId,
        inviteeUserId: relation.inviteeUserId,
        campaignId: relation.sourceCampaignId,
        rewardType: 'reconcile_marker',
        rewardName: reason,
        status: FIRST_PAID_ISSUED,
        sourceType: 'first_paid_reconcile_complete',
        sourceId: orderId,
        dedupeKey: `first_paid:complete:${orderId}`,
        issuedAt: new Date(),
      }],
      skipDuplicates: true,
    });
  }

  private async assertCampaignRewardConfiguration(data: any) {
    const name = String(data.name || '').trim();
    if (!name || name.length > 100) throw new BadRequestException('裂变活动名称不能为空且不能超过100个字符');
    if (!['points', 'coupon', 'both'].includes(String(data.rewardType || ''))) {
      throw new BadRequestException('裂变活动奖励类型无效');
    }
    const startTime = new Date(data.startTime);
    const endTime = new Date(data.endTime);
    if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime()) || startTime >= endTime) {
      throw new BadRequestException('裂变活动结束时间必须晚于开始时间');
    }
    if (data.status !== undefined && ![0, 1].includes(Number(data.status))) {
      throw new BadRequestException('裂变活动状态无效');
    }

    const inviterConfig: any = data.inviterRewardConfig || {};
    if (data.rewardType === 'points' || data.rewardType === 'both') {
      const points = Number(inviterConfig.points || 0);
      if (!Number.isSafeInteger(points) || points <= 0) {
        throw new BadRequestException('邀请人首单积分奖励必须为正整数');
      }
    }
    if (data.rewardType === 'coupon' || data.rewardType === 'both') {
      const couponId = parsePositiveBigIntId(inviterConfig.couponId, '邀请人首单奖励优惠券');
      const coupon = await this.durablePrisma.coupon.findUnique({ where: { id: couponId } });
      if (!coupon) throw new BadRequestException('邀请人首单奖励优惠券不存在');
      if (coupon.validDays <= 0) {
        throw new BadRequestException('首单奖励会在售后期结束后发放，奖励优惠券必须设置“领取后有效天数”大于0');
      }
    }
  }
}
