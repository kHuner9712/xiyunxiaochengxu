import { ReferentiallySafeCouponService } from './referentially-safe-coupon.service';

function fixture() {
  const tx: any = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: 7n }]),
    coupon: {
      findUnique: jest.fn().mockResolvedValue({ id: 7n, name: '奖励券', status: 1 }),
      update: jest.fn().mockResolvedValue({ id: 7n, name: '奖励券', status: 0 }),
      delete: jest.fn().mockResolvedValue({}),
    },
    userCoupon: { count: jest.fn().mockResolvedValue(0) },
    userInviteReward: { count: jest.fn().mockResolvedValue(0) },
    shareCampaign: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const prisma: any = {
    ...tx,
    $transaction: jest.fn(async (callback: any) => callback(tx)),
  };
  return { service: new ReferentiallySafeCouponService(prisma), prisma, tx };
}

describe('ReferentiallySafeCouponService', () => {
  it('disables instead of deleting a coupon referenced by a delayed invite reward', async () => {
    const { service, tx } = fixture();
    tx.userInviteReward.count.mockResolvedValue(1);

    const result = await service.delete('7');

    expect(tx.coupon.update).toHaveBeenCalledWith({ where: { id: 7n }, data: { status: 0 } });
    expect(tx.coupon.delete).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({
      id: '7',
      status: 0,
      deleted: false,
      protectedReferences: expect.objectContaining({ rewardReferenceCount: 1 }),
    }));
  });

  it('protects coupons still referenced by campaign configuration', async () => {
    const { service, tx } = fixture();
    tx.shareCampaign.findMany.mockResolvedValue([{
      id: 3n,
      inviterRewardConfig: { couponId: '7' },
      inviteeRewardConfig: null,
    }]);

    const result = await service.delete('7');

    expect(tx.coupon.delete).not.toHaveBeenCalled();
    expect(result.protectedReferences.campaignReferenceCount).toBe(1);
  });

  it('physically deletes an unreferenced never-issued coupon', async () => {
    const { service, tx } = fixture();

    const result = await service.delete('7');

    expect(tx.coupon.delete).toHaveBeenCalledWith({ where: { id: 7n } });
    expect(tx.coupon.update).not.toHaveBeenCalled();
    expect(result.deleted).toBe(true);
  });
});
