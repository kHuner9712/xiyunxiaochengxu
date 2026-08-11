import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AFTERSALE_APPLY_DAYS, POINTS_EXPIRE_MONTHS } from '@baby-mall/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { PointsService } from '../points/points.service';
import { CouponService } from '../coupon/coupon.service';
import { ShareService } from './share.service';

@Injectable()
export class ProductionShareService extends ShareService {
  private readonly productionLogger = new Logger(ProductionShareService.name);

  constructor(
    private readonly productionPrisma: PrismaService,
    private readonly productionRedis: RedisService,
    productionPoints: PointsService,
    productionCoupon: CouponService,
  ) {
    super(productionPrisma, productionRedis, productionPoints, productionCoupon);
  }

  override async processFirstPaidReward(
    inviteeUserId: string,
    orderId: string,
    paidAmount: number,
  ) {
    const relation = await this.productionPrisma.userInviteRelation.findFirst({
      where: { inviteeUserId: BigInt(inviteeUserId), status: 1 },
    });
    if (!relation) return;

    const lockKey = `share:first-paid:${relation.id}`;
    const lockValue = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const locked = await this.productionRedis.setNX(lockKey, lockValue, 120);
    if (!locked) return;

    try {
      const current = await this.productionPrisma.userInviteRelation.findUnique({
        where: { id: relation.id },
      });
      if (!current) return;
      if (current.firstPaidOrderId && current.firstPaidOrderId !== BigInt(orderId)) {
        return;
      }

      if (!current.firstPaidOrderId) {
        const claimed = await this.productionPrisma.userInviteRelation.updateMany({
          where: { id: current.id, firstPaidOrderId: null, status: 1 },
          data: {
            firstPaidOrderId: BigInt(orderId),
            firstPaidAt: new Date(),
          },
        });
        if (claimed.count === 0) {
          const refreshed = await this.productionPrisma.userInviteRelation.findUnique({
            where: { id: current.id },
          });
          if (refreshed?.firstPaidOrderId !== BigInt(orderId)) return;
        }
      }

      await this.recordFirstPaidAttribution(current.id, orderId, paidAmount);
    } finally {
      await this.productionRedis.releaseLockWithLua(lockKey, lockValue);
    }
  }

  async reconcileMatureFirstPaidRewards(limit = 200) {
    await this.reconcileSuccessfulRefundAttributions(limit);

    const cutoff = new Date(
      Date.now() - AFTERSALE_APPLY_DAYS * 24 * 60 * 60 * 1000,
    );

    const candidateRows = await this.productionPrisma.$queryRaw<Array<{ relationId: bigint }>>`
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
        const relation = await this.productionPrisma.userInviteRelation.findUnique({
          where: { id: candidate.relationId },
        });
        if (!relation?.firstPaidOrderId) {
          skipped += 1;
          continue;
        }
        const order = await this.productionPrisma.order.findUnique({
          where: { id: relation.firstPaidOrderId },
          select: {
            id: true,
            status: true,
            paidAt: true,
            completedAt: true,
            payAmount: true,
          },
        });
        if (!order?.completedAt || order.status !== 'completed' || order.completedAt > cutoff) {
          skipped += 1;
          continue;
        }

        const successfulRefunds = await this.productionPrisma.orderRefund.aggregate({
          where: { orderId: order.id, status: 'success' },
          _sum: { refundAmount: true },
        });
        const grossPaid = Math.max(0, order.payAmount ?? 0);
        const refundedAmount = Math.min(
          grossPaid,
          Math.max(0, successfulRefunds._sum.refundAmount ?? 0),
        );
        const netPaidAmount = Math.max(0, grossPaid - refundedAmount);
        if (netPaidAmount <= 0) {
          await this.markFirstPaidRewardReconciled(relation, order.id, '订单已全额退款，无成熟首单奖励');
          skipped += 1;
          continue;
        }

        const before = await this.productionPrisma.userInviteReward.count({
          where: {
            sourceType: 'first_paid_order',
            sourceId: order.id,
            status: 'issued',
          },
        });
        await this.issueCampaignRewards(relation, order.id, order.paidAt);
        const after = await this.productionPrisma.userInviteReward.count({
          where: {
            sourceType: 'first_paid_order',
            sourceId: order.id,
            status: 'issued',
          },
        });
        await this.markFirstPaidRewardReconciled(relation, order.id, '成熟首单奖励已完成幂等核对');
        if (after > before) issued += 1;
        else skipped += 1;
      } catch (error) {
        failed += 1;
        this.productionLogger.error(
          `首单奖励补偿失败: relationId=${candidate.relationId}, error=${(error as Error).message}`,
        );
      }
    }
    return { total: candidateRows.length, issued, skipped, failed };
  }

  async reconcileSuccessfulRefundAttributions(limit = 200) {
    const refunds = await this.productionPrisma.$queryRaw<Array<{ id: bigint; orderId: bigint }>>`
      SELECT DISTINCT r.id AS id, r.order_id AS orderId
      FROM order_refunds r
      INNER JOIN user_invite_relations rel
        ON rel.first_paid_order_id = r.order_id
       AND rel.status = 1
       AND rel.source_share_record_id IS NOT NULL
      WHERE r.status = 'success'
        AND EXISTS (
          SELECT 1
          FROM user_invite_rewards attribution
          WHERE attribution.dedupe_key = CONCAT('first_paid:attribution:', r.order_id)
            AND attribution.deleted_at IS NULL
        )
        AND NOT EXISTS (
          SELECT 1
          FROM user_invite_rewards marker
          WHERE marker.dedupe_key = CONCAT('first_paid:refund_attribution:', r.id)
            AND marker.deleted_at IS NULL
        )
      ORDER BY r.id ASC
      LIMIT ${limit}
    `;

    let adjusted = 0;
    let skipped = 0;
    let failed = 0;
    for (const refund of refunds) {
      try {
        const result = await this.reverseFirstPaidAttributionAfterRefund(
          refund.orderId,
          refund.id,
        );
        if (result.adjusted) adjusted += 1;
        else skipped += 1;
      } catch (error) {
        failed += 1;
        this.productionLogger.error(
          `首单退款归因补偿失败: refundId=${refund.id}, error=${(error as Error).message}`,
        );
      }
    }
    return { total: refunds.length, adjusted, skipped, failed };
  }

  async reverseFirstPaidAttributionAfterRefund(
    orderId: bigint | string,
    refundId: bigint | string,
  ) {
    const orderIdValue = BigInt(orderId);
    const refundIdValue = BigInt(refundId);
    const relation = await this.productionPrisma.userInviteRelation.findFirst({
      where: {
        firstPaidOrderId: orderIdValue,
        status: 1,
        sourceShareRecordId: { not: null },
      },
      select: {
        inviterUserId: true,
        inviteeUserId: true,
        sourceCampaignId: true,
        sourceShareRecordId: true,
      },
    });
    if (!relation?.sourceShareRecordId) return { adjusted: false, fullReversed: false };

    const attribution = await this.productionPrisma.userInviteReward.findUnique({
      where: { dedupeKey: `first_paid:attribution:${orderIdValue}` },
      select: { id: true },
    });
    if (!attribution) return { adjusted: false, fullReversed: false };

    const [order, refund] = await Promise.all([
      this.productionPrisma.order.findUnique({
        where: { id: orderIdValue },
        select: { payAmount: true },
      }),
      this.productionPrisma.orderRefund.findUnique({
        where: { id: refundIdValue },
        select: { status: true, refundAmount: true },
      }),
    ]);
    if (!order || !refund || refund.status !== 'success' || refund.refundAmount <= 0) {
      return { adjusted: false, fullReversed: false };
    }

    const cumulativeRefunds = await this.productionPrisma.orderRefund.aggregate({
      where: { orderId: orderIdValue, status: 'success' },
      _sum: { refundAmount: true },
    });
    const grossPaid = Math.max(0, order.payAmount ?? 0);
    const totalRefunded = Math.min(
      grossPaid,
      Math.max(0, cumulativeRefunds._sum.refundAmount ?? 0),
    );

    return this.productionPrisma.$transaction(async (tx) => {
      const refundMarker = await tx.userInviteReward.createMany({
        data: [{
          userId: relation.inviterUserId,
          inviteeUserId: relation.inviteeUserId,
          campaignId: relation.sourceCampaignId,
          rewardType: 'attribution_adjustment',
          rewardName: '首单退款归因金额冲减',
          status: 'issued',
          sourceType: 'first_paid_refund_attribution',
          sourceId: refundIdValue,
          dedupeKey: `first_paid:refund_attribution:${refundIdValue}`,
          issuedAt: new Date(),
        }],
        skipDuplicates: true,
      });
      if (refundMarker.count === 0) {
        return { adjusted: false, fullReversed: false };
      }

      await tx.$executeRaw`
        UPDATE share_records
        SET paid_order_amount = GREATEST(paid_order_amount - ${refund.refundAmount}, 0)
        WHERE id = ${relation.sourceShareRecordId}
      `;

      let fullReversed = false;
      if (grossPaid > 0 && totalRefunded >= grossPaid) {
        const fullMarker = await tx.userInviteReward.createMany({
          data: [{
            userId: relation.inviterUserId,
            inviteeUserId: relation.inviteeUserId,
            campaignId: relation.sourceCampaignId,
            rewardType: 'attribution_adjustment',
            rewardName: '首单全额退款归因订单数冲减',
            status: 'issued',
            sourceType: 'first_paid_full_refund_attribution',
            sourceId: orderIdValue,
            dedupeKey: `first_paid:full_refund_attribution:${orderIdValue}`,
            issuedAt: new Date(),
          }],
          skipDuplicates: true,
        });
        if (fullMarker.count === 1) {
          await tx.$executeRaw`
            UPDATE share_records
            SET order_count = GREATEST(order_count - 1, 0)
            WHERE id = ${relation.sourceShareRecordId}
          `;
          fullReversed = true;
        }
      }

      return { adjusted: true, fullReversed };
    });
  }

  private async recordFirstPaidAttribution(
    relationId: bigint,
    orderId: string,
    paidAmount: number,
  ) {
    const relation = await this.productionPrisma.userInviteRelation.findUnique({
      where: { id: relationId },
    });
    if (!relation?.sourceShareRecordId) return;

    const dedupeKey = `first_paid:attribution:${orderId}`;
    try {
      await this.productionPrisma.$transaction(async (tx) => {
        await tx.userInviteReward.create({
          data: {
            userId: relation.inviterUserId,
            inviteeUserId: relation.inviteeUserId,
            campaignId: relation.sourceCampaignId,
            rewardType: 'attribution',
            rewardName: '首单归因',
            status: 'issued',
            sourceType: 'first_paid_attribution',
            sourceId: BigInt(orderId),
            dedupeKey,
            issuedAt: new Date(),
          },
        });
        await tx.shareRecord.update({
          where: { id: relation.sourceShareRecordId! },
          data: {
            orderCount: { increment: 1 },
            paidOrderAmount: { increment: paidAmount },
          },
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return;
      }
      throw error;
    }
  }

  private async issueCampaignRewards(
    relation: any,
    orderId: bigint,
    paidAt: Date | null,
  ) {
    if (!relation.sourceCampaignId || !paidAt) return;
    const campaign = await this.productionPrisma.shareCampaign.findFirst({
      where: { id: relation.sourceCampaignId, status: 1 },
    });
    if (!campaign) return;
    if (paidAt < campaign.startTime || paidAt > campaign.endTime) return;

    const inviterConfig: any = campaign.inviterRewardConfig;
    if (!inviterConfig) return;

    if (campaign.rewardType === 'points' || campaign.rewardType === 'both') {
      const points = Number(inviterConfig.points || 0);
      if (Number.isSafeInteger(points) && points > 0) {
        await this.issuePointsRewardAtomic(relation, orderId, points);
      }
    }

    if (campaign.rewardType === 'coupon' || campaign.rewardType === 'both') {
      const couponId = inviterConfig.couponId ? BigInt(inviterConfig.couponId) : null;
      if (couponId) {
        await this.issueCouponRewardAtomic(relation, orderId, couponId);
      }
    }
  }

  private async issuePointsRewardAtomic(relation: any, orderId: bigint, points: number) {
    const dedupeKey = `first_paid:points:${orderId}`;
    try {
      await this.productionPrisma.$transaction(async (tx) => {
        const existing = await tx.userInviteReward.findUnique({
          where: { dedupeKey },
          select: { id: true },
        });
        if (existing) return;

        const user = await tx.user.findUnique({
          where: { id: relation.inviterUserId },
          select: { availablePoints: true },
        });
        if (!user) throw new NotFoundException('邀请人不存在，无法发放首单积分奖励');

        const expireAt = new Date();
        expireAt.setMonth(expireAt.getMonth() + POINTS_EXPIRE_MONTHS);
        expireAt.setDate(expireAt.getDate() - 1);
        expireAt.setHours(23, 59, 59, 0);

        await tx.user.update({
          where: { id: relation.inviterUserId },
          data: {
            totalPoints: { increment: points },
            availablePoints: { increment: points },
          },
        });
        await tx.pointsRecord.create({
          data: {
            userId: relation.inviterUserId,
            type: 1,
            points,
            balance: user.availablePoints + points,
            source: 'inviter_first_paid',
            sourceId: orderId,
            description: `邀请好友首单奖励${points}积分`,
            expireAt,
          },
        });
        await tx.userInviteReward.create({
          data: {
            userId: relation.inviterUserId,
            inviteeUserId: relation.inviteeUserId,
            campaignId: relation.sourceCampaignId,
            rewardType: 'points',
            rewardName: `邀请好友首单奖励${points}积分`,
            points,
            status: 'issued',
            sourceType: 'first_paid_order',
            sourceId: orderId,
            dedupeKey,
            issuedAt: new Date(),
          },
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return;
      throw error;
    }
  }

  private async issueCouponRewardAtomic(relation: any, orderId: bigint, couponId: bigint) {
    const dedupeKey = `first_paid:coupon:${orderId}:${couponId}`;
    try {
      await this.productionPrisma.$transaction(async (tx) => {
        const existing = await tx.userInviteReward.findUnique({
          where: { dedupeKey },
          select: { id: true },
        });
        if (existing) return;

        const coupon = await tx.coupon.findFirst({
          where: { id: couponId, status: 1 },
        });
        if (!coupon) throw new NotFoundException('邀请奖励优惠券不存在或已停用');
        const now = new Date();
        if (now < coupon.startTime || now > coupon.endTime) {
          throw new BadRequestException('邀请奖励优惠券不在有效发放时间范围内');
        }

        if (coupon.totalCount > 0) {
          const claimed = await tx.coupon.updateMany({
            where: { id: coupon.id, receivedCount: { lt: coupon.totalCount } },
            data: { receivedCount: { increment: 1 } },
          });
          if (claimed.count !== 1) {
            throw new BadRequestException('邀请奖励优惠券库存不足');
          }
        } else {
          await tx.coupon.update({
            where: { id: coupon.id },
            data: { receivedCount: { increment: 1 } },
          });
        }

        const expireAt = coupon.validDays && coupon.validDays > 0
          ? new Date(now.getTime() + coupon.validDays * 24 * 60 * 60 * 1000)
          : coupon.endTime;
        await tx.userCoupon.create({
          data: {
            userId: relation.inviterUserId,
            couponId: coupon.id,
            expireAt,
          },
        });
        await tx.userInviteReward.create({
          data: {
            userId: relation.inviterUserId,
            inviteeUserId: relation.inviteeUserId,
            campaignId: relation.sourceCampaignId,
            rewardType: 'coupon',
            rewardName: '邀请好友首单优惠券奖励',
            couponId: coupon.id,
            status: 'issued',
            sourceType: 'first_paid_order',
            sourceId: orderId,
            dedupeKey,
            issuedAt: new Date(),
          },
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return;
      throw error;
    }
  }

  private async markFirstPaidRewardReconciled(
    relation: any,
    orderId: bigint,
    reason: string,
  ) {
    try {
      await this.productionPrisma.userInviteReward.create({
        data: {
          userId: relation.inviterUserId,
          inviteeUserId: relation.inviteeUserId,
          campaignId: relation.sourceCampaignId,
          rewardType: 'reconcile_marker',
          rewardName: reason,
          status: 'issued',
          sourceType: 'first_paid_reconcile_complete',
          sourceId: orderId,
          dedupeKey: `first_paid:complete:${orderId}`,
          issuedAt: new Date(),
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return;
      throw error;
    }
  }
}
