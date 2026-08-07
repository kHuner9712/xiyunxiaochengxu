import { BadRequestException } from '@nestjs/common';
import { ProductionShareService } from './production-share.service';

function createService() {
  const tx: any = {
    userInviteReward: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 1n }),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({ availablePoints: 100 }),
      update: jest.fn().mockResolvedValue({}),
    },
    pointsRecord: {
      create: jest.fn().mockResolvedValue({}),
    },
    coupon: {
      findFirst: jest.fn().mockResolvedValue({
        id: 7n,
        status: 1,
        startTime: new Date(Date.now() - 60_000),
        endTime: new Date(Date.now() + 86_400_000),
        totalCount: 10,
        receivedCount: 2,
        validDays: 7,
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({}),
    },
    userCoupon: {
      create: jest.fn().mockResolvedValue({ id: 9n }),
    },
  };
  const prisma: any = {
    $transaction: jest.fn(async (fn: any) => fn(tx)),
  };
  const redis: any = {};
  const points: any = {};
  const coupon: any = {};
  const service = new ProductionShareService(prisma, redis, points, coupon);
  return { service, prisma, tx };
}

const relation = {
  inviterUserId: 1n,
  inviteeUserId: 2n,
  sourceCampaignId: 3n,
};

describe('ProductionShareService atomic mature rewards', () => {
  it('writes points balance, ledger and reward marker in one transaction', async () => {
    const { service, prisma, tx } = createService();

    await (service as any).issuePointsRewardAtomic(relation, 42n, 20);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 1n },
      data: {
        totalPoints: { increment: 20 },
        availablePoints: { increment: 20 },
      },
    });
    expect(tx.pointsRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 1n,
        points: 20,
        balance: 120,
        source: 'inviter_first_paid',
        sourceId: 42n,
      }),
    });
    expect(tx.userInviteReward.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        dedupeKey: 'first_paid:points:42',
        status: 'issued',
      }),
    });
  });

  it('does not move points when the reward marker already exists', async () => {
    const { service, tx } = createService();
    tx.userInviteReward.findUnique.mockResolvedValueOnce({ id: 99n });

    await (service as any).issuePointsRewardAtomic(relation, 42n, 20);

    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.pointsRecord.create).not.toHaveBeenCalled();
    expect(tx.userInviteReward.create).not.toHaveBeenCalled();
  });

  it('creates a new user coupon and reward marker atomically instead of accepting an unrelated existing coupon', async () => {
    const { service, tx } = createService();

    await (service as any).issueCouponRewardAtomic(relation, 42n, 7n);

    expect(tx.coupon.updateMany).toHaveBeenCalledWith({
      where: { id: 7n, receivedCount: { lt: 10 } },
      data: { receivedCount: { increment: 1 } },
    });
    expect(tx.userCoupon.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 1n,
        couponId: 7n,
      }),
    });
    expect(tx.userInviteReward.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        dedupeKey: 'first_paid:coupon:42:7',
        couponId: 7n,
        status: 'issued',
      }),
    });
  });

  it('does not create a user coupon when the reward marker already exists', async () => {
    const { service, tx } = createService();
    tx.userInviteReward.findUnique.mockResolvedValueOnce({ id: 99n });

    await (service as any).issueCouponRewardAtomic(relation, 42n, 7n);

    expect(tx.coupon.findFirst).not.toHaveBeenCalled();
    expect(tx.coupon.updateMany).not.toHaveBeenCalled();
    expect(tx.userCoupon.create).not.toHaveBeenCalled();
  });

  it('fails the entire coupon grant when inventory cannot be claimed', async () => {
    const { service, tx } = createService();
    tx.coupon.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      (service as any).issueCouponRewardAtomic(relation, 42n, 7n),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.userCoupon.create).not.toHaveBeenCalled();
    expect(tx.userInviteReward.create).not.toHaveBeenCalled();
  });
});
