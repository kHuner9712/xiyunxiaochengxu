import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { CouponService } from './coupon.service';
import { COUPON_STATUS } from '../common/constants/payment';

function createMockPrisma() {
  const prisma: any = {
    coupon: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    userCoupon: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    order: { count: jest.fn() },
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    product: { findMany: jest.fn() },
    $queryRaw: jest.fn(),
  };
  prisma.$transaction = jest.fn(async (callback: any) => callback(prisma));
  return prisma;
}

describe('CouponService production semantics', () => {
  let service: CouponService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    prisma.userCoupon.updateMany.mockResolvedValue({ count: 0 });
    prisma.userCoupon.findMany.mockResolvedValue([]);
    prisma.userCoupon.count.mockResolvedValue(0);
    service = new CouponService(prisma as any);
    jest.spyOn(service['logger'], 'log').mockImplementation(() => {});
  });

  it('findMyCoupons scopes by owner and uses the requested display status', async () => {
    await service.findMyCoupons('100', 1);

    expect(prisma.userCoupon.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { userId: 100n, status: COUPON_STATUS.FREE },
      skip: 0,
      take: 20,
    }));
  });

  it('findMyCoupons returns an empty pagination shape when user has no coupons', async () => {
    const result = await service.findMyCoupons('100', 1, 1, 10);

    expect(result).toEqual({ list: [], total: 0, page: 1, pageSize: 10 });
  });

  it('maps front tab used and expired statuses to the canonical database statuses', async () => {
    await service.findMyCoupons('100', 2);
    expect(prisma.userCoupon.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { userId: 100n, status: COUPON_STATUS.USED },
    }));

    await service.findMyCoupons('100', 3);
    expect(prisma.userCoupon.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { userId: 100n, status: COUPON_STATUS.EXPIRED },
    }));
  });

  it('findUsable uses UserCoupon expiry and does not reapply the master receiving window', async () => {
    await service.findUsable('100', 5000);

    const call = prisma.userCoupon.findMany.mock.calls.at(-1)?.[0];
    expect(call).toEqual(expect.objectContaining({
      where: expect.objectContaining({
        userId: 100n,
        status: COUPON_STATUS.FREE,
        coupon: { minAmount: { lte: 5000 } },
      }),
    }));
    expect(call.where.coupon.startTime).toBeUndefined();
    expect(call.where.coupon.endTime).toBeUndefined();
  });

  it('rolling-validity coupons remain valid for validDays after receipt even beyond the receive endTime', async () => {
    const receiveEnd = new Date(Date.now() + 60 * 60 * 1000);
    prisma.$queryRaw.mockResolvedValue([{ id: 1n }]);
    prisma.coupon.findUnique.mockResolvedValue({
      id: 7n,
      status: 1,
      startTime: new Date(Date.now() - 60 * 60 * 1000),
      endTime: receiveEnd,
      totalCount: 100,
      receivedCount: 0,
      perLimit: 1,
      validDays: 7,
      memberLevelId: null,
      isNewUser: 0,
      applicableIds: { ids: [], description: '' },
      type: 1,
      value: 1000,
      minAmount: 5000,
      discountLimit: 0,
      applicableType: 0,
    });
    prisma.user.findUnique.mockResolvedValue({ memberLevelId: null });
    prisma.userCoupon.count.mockResolvedValue(0);
    prisma.userCoupon.create.mockImplementation(async ({ data }: any) => ({
      id: 9n,
      ...data,
      usedAt: null,
      usedOrderId: null,
      coupon: await prisma.coupon.findUnique(),
    }));
    prisma.coupon.update.mockResolvedValue({});

    const result = await service.receive('1', '7');

    const createData = prisma.userCoupon.create.mock.calls[0][0].data;
    expect(createData.expireAt.getTime()).toBeGreaterThan(receiveEnd.getTime());
    expect(createData.expireAt.getTime()).toBeGreaterThan(Date.now() + 6 * 24 * 60 * 60 * 1000);
    expect(result.expireAt).toEqual(createData.expireAt);
  });
});
