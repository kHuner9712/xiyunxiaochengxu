import { Injectable, Logger } from '@nestjs/common';
import { AFTERSALE_APPLY_DAYS } from '@baby-mall/shared';
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
    private readonly productionPoints: PointsService,
    private readonly productionCoupon: CouponService,
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
    const cutoff = new Date(
      Date.now() - AFTERSALE_APPLY_DAYS * 24 * 60 * 60 * 1000,
    );
    const relations = await this.productionPrisma.userInviteRelation.findMany({
      where: {
        status: 1,
        firstPaidOrderId: { not: null },
      },
      orderBy: { firstPaidAt: 'asc' },
      take: limit,
    });

    let issued = 0;
    let skipped = 0;
    let failed = 0;
    for (const relation of relations) {
      try {
        const order = await this.productionPrisma.order.findUnique({
          where: { id: relation.firstPaidOrderId! },
          select: {
            id: true,
            status: true,
            paidAt: true,
            completedAt: true,
            payAmount: true,
          },
        });
        if (!order?.completedAt || order.completedAt > cutoff) {
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
        if (after > before) issued += 1;
        else skipped += 1;
      } catch (error) {
        failed += 1;
        this.productionLogger.error(
          `首单奖励补偿失败: relationId=${relation.id}, error=${(error as Error).message}`,
        );
      }
    }
    return { total: relations.length, issued, skipped, failed };
  }

  /**
   * 退款成功后反向修正分享首单归因报表。
   * 每笔退款按 refundId 幂等扣减 paidOrderAmount；累计全额退款时 orderCount 只减一次。
   */
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
    const inviterUserId = relation.inviterUserId.toString();

    if (campaign.rewardType === 'points' || campaign.rewardType === 'both') {
      const points = Number(inviterConfig.points || 0);
      if (points > 0) {
        const existing = await this.productionPrisma.pointsRecord.findFirst({
          where: {
            userId: relation.inviterUserId,
            source: 'inviter_first_paid',
            sourceId: orderId,
          },
          select: { id: true },
        });
        if (!existing) {
          await this.productionPoints.earnPoints(
            inviterUserId,
            points,
            'inviter_first_paid',
            orderId.toString(),
            `邀请好友首单奖励${points}积分`,
          );
        }
        await this.ensureRewardRecord({
          userId: relation.inviterUserId,
          inviteeUserId: relation.inviteeUserId,
          campaignId: relation.sourceCampaignId,
          rewardType: 'points',
          rewardName: `邀请好友首单奖励${points}积分`,
          points,
          sourceId: orderId,
          dedupeKey: `first_paid:points:${orderId}`,
        });
      }
    }

    if (campaign.rewardType === 'coupon' || campaign.rewardType === 'both') {
      const couponId = inviterConfig.couponId ? BigInt(inviterConfig.couponId) : null;
      if (couponId) {
        const reward = await this.productionPrisma.userInviteReward.findUnique({
          where: { dedupeKey: `first_paid:coupon:${orderId}:${couponId}` },
        });
        if (!reward) {
          try {
            await this.productionCoupon.receive(inviterUserId, couponId.toString());
          } catch (error) {
            const owned = await this.productionPrisma.userCoupon.findFirst({
              where: {
                userId: relation.inviterUserId,
                couponId,
                status: { in: [1, 2, 3] },
              },
              select: { id: true },
            });
            if (!owned) throw error;
          }
        }
        await this.ensureRewardRecord({
          userId: relation.inviterUserId,
          inviteeUserId: relation.inviteeUserId,
          campaignId: relation.sourceCampaignId,
          rewardType: 'coupon',
          rewardName: '邀请好友首单优惠券奖励',
          couponId,
          sourceId: orderId,
          dedupeKey: `first_paid:coupon:${orderId}:${couponId}`,
        });
      }
    }
  }

  private async ensureRewardRecord(data: {
    userId: bigint;
    inviteeUserId: bigint;
    campaignId: bigint;
    rewardType: string;
    rewardName: string;
    couponId?: bigint;
    points?: number;
    sourceId: bigint;
    dedupeKey: string;
  }) {
    try {
      await this.productionPrisma.userInviteReward.create({
        data: {
          userId: data.userId,
          inviteeUserId: data.inviteeUserId,
          campaignId: data.campaignId,
          rewardType: data.rewardType,
          rewardName: data.rewardName,
          couponId: data.couponId ?? null,
          points: data.points ?? null,
          status: 'issued',
          sourceType: 'first_paid_order',
          sourceId: data.sourceId,
          dedupeKey: data.dedupeKey,
          issuedAt: new Date(),
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return;
      }
      throw error;
    }
  }
}
