import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { CouponService } from './coupon.service';

@Injectable()
export class ReferentiallySafeCouponService extends CouponService {
  constructor(private readonly safeCouponPrisma: PrismaService) {
    super(safeCouponPrisma);
  }

  override async delete(id: string) {
    const couponId = parsePositiveBigIntId(id, '优惠券');
    const result = await this.safeCouponPrisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM coupons WHERE id = ${couponId} FOR UPDATE`;
      const coupon = await tx.coupon.findUnique({ where: { id: couponId } });
      if (!coupon) throw new NotFoundException('优惠券不存在');

      const [issuedCount, rewardReferenceCount, campaigns] = await Promise.all([
        tx.userCoupon.count({ where: { couponId } }),
        tx.userInviteReward.count({ where: { couponId, deletedAt: null } }),
        tx.shareCampaign.findMany({
          select: { id: true, inviterRewardConfig: true, inviteeRewardConfig: true },
        }),
      ]);
      const campaignReferenceCount = campaigns.filter((campaign) =>
        this.rewardConfigReferencesCoupon(campaign.inviterRewardConfig, couponId) ||
        this.rewardConfigReferencesCoupon(campaign.inviteeRewardConfig, couponId),
      ).length;

      // Coupons referenced by issued holdings, durable delayed rewards or campaign configuration
      // are historical/economic records. They may stop public receiving, but must not disappear
      // from the master table before all promised rewards are settled.
      if (issuedCount > 0 || rewardReferenceCount > 0 || campaignReferenceCount > 0) {
        const disabled = await tx.coupon.update({
          where: { id: couponId },
          data: { status: 0 },
        });
        return {
          coupon: disabled,
          deleted: false,
          protectedReferences: {
            issuedCount,
            rewardReferenceCount,
            campaignReferenceCount,
          },
        };
      }

      await tx.coupon.delete({ where: { id: couponId } });
      return {
        coupon,
        deleted: true,
        protectedReferences: {
          issuedCount: 0,
          rewardReferenceCount: 0,
          campaignReferenceCount: 0,
        },
      };
    });

    return {
      ...(this as any).serializeCoupon(result.coupon),
      deleted: result.deleted,
      protectedReferences: result.protectedReferences,
    };
  }

  private rewardConfigReferencesCoupon(raw: unknown, couponId: bigint) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
    const value = (raw as Record<string, unknown>).couponId;
    if (value === undefined || value === null || value === '') return false;
    try {
      return parsePositiveBigIntId(value, '奖励优惠券') === couponId;
    } catch {
      return false;
    }
  }
}
