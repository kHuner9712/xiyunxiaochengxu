import { BadRequestException } from '@nestjs/common';
import { DurableRewardProductionShareService } from './durable-reward-production-share.service';

function createService() {
  const tx: any = {
    userInviteRelation: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    userInviteReward: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    pointsRecord: {
      create: jest.fn().mockResolvedValue({}),
    },
    coupon: {
      findUnique: jest.fn().mockResolvedValue({
        id: 7n,
        status: 0,
        startTime: new Date(Date.now() - 86_400_000),
        endTime: new Date(Date.now() - 60_000),
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
    shareCampaign: {
      findUnique: jest.fn(),
    },
    shareRecord: {
      update: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };
  const prisma: any = {
    ...tx,
    $transaction: jest.fn(async (fn: any) => fn(tx)),
  };
  const redis: any = {
    setNX: jest.fn().mockResolvedValue(true),
    releaseLockWithLua: jest.fn().mockResolvedValue(true),
  };
  const points: any = {};
  const coupon: any = {};
  const systemConfig: any = {
    getRuntimeConfig: jest.fn().mockReturnValue({ aftersaleApplyDays: 10 }),
  };
  const service = new DurableRewardProductionShareService(
    prisma,
    redis,
    points,
    coupon,
    systemConfig,
  );
  return { service, prisma, tx, redis, systemConfig };
}

describe('DurableRewardProductionShareService', () => {
  it('settles a snapshotted points reward atomically', async () => {
    const { service, prisma, tx } = createService();
    tx.$queryRaw.mockResolvedValue([{ id: 1n, availablePoints: 100 }]);
    const reward = {
      id: 11n,
      userId: 1n,
      rewardType: 'points',
      points: 20,
      sourceId: 42n,
      status: 'pending',
    };

    await (service as any).settlePointsReward(reward);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.userInviteReward.updateMany).toHaveBeenCalledWith({
      where: { id: 11n, status: 'pending', deletedAt: null },
      data: { status: 'issuing' },
    });
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
    expect(tx.userInviteReward.update).toHaveBeenCalledWith({
      where: { id: 11n },
      data: expect.objectContaining({ status: 'issued' }),
    });
  });

  it('settles an already-earned rolling coupon after the public receive window has ended', async () => {
    const { service, tx } = createService();
    const reward = {
      id: 12n,
      userId: 1n,
      rewardType: 'coupon',
      couponId: 7n,
      sourceId: 42n,
      status: 'pending',
    };

    await (service as any).settleCouponReward(reward);

    expect(tx.coupon.findUnique).toHaveBeenCalledWith({ where: { id: 7n } });
    expect(tx.coupon.updateMany).toHaveBeenCalledWith({
      where: { id: 7n, receivedCount: { lt: 10 } },
      data: { receivedCount: { increment: 1 } },
    });
    expect(tx.userCoupon.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 1n,
        couponId: 7n,
        status: 1,
        expireAt: expect.any(Date),
      }),
    });
    const expireAt = tx.userCoupon.create.mock.calls[0][0].data.expireAt as Date;
    expect(expireAt.getTime()).toBeGreaterThan(Date.now() + 6 * 24 * 60 * 60 * 1000);
  });

  it('rolls back coupon settlement when reward inventory cannot be claimed', async () => {
    const { service, tx } = createService();
    tx.coupon.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect((service as any).settleCouponReward({
      id: 12n,
      userId: 1n,
      rewardType: 'coupon',
      couponId: 7n,
      sourceId: 42n,
      status: 'pending',
    })).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.userCoupon.create).not.toHaveBeenCalled();
    expect(tx.userInviteReward.update).not.toHaveBeenCalled();
  });

  it('rejects fixed-end coupons for delayed inviter rewards', async () => {
    const { service, prisma } = createService();
    prisma.coupon.findUnique.mockResolvedValueOnce({ id: 7n, validDays: 0 });

    await expect(service.createCampaign({
      name: '首单邀请活动',
      type: 'invite',
      rewardType: 'coupon',
      inviterRewardConfig: { couponId: '7' },
      startTime: new Date(Date.now() - 60_000).toISOString(),
      endTime: new Date(Date.now() + 86_400_000).toISOString(),
      status: 1,
    })).rejects.toThrow('奖励优惠券必须设置“领取后有效天数”大于0');
  });

  it('uses the runtime aftersale window instead of a hard-coded maturity period', async () => {
    const { service, prisma, systemConfig } = createService();
    prisma.$queryRaw.mockResolvedValue([]);
    prisma.orderRefund = { aggregate: jest.fn() };

    const result = await service.reconcileMatureFirstPaidRewards(50);

    expect(systemConfig.getRuntimeConfig).toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ aftersaleDays: 10 }));
  });
});
