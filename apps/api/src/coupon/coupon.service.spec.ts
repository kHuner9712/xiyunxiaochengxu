import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { CouponService } from './coupon.service';
import { COUPON_STATUS } from '../common/constants/payment';

function createMockPrisma() {
  return {
    coupon: {
      findMany: jest.fn() as any,
      count: jest.fn() as any,
      findFirst: jest.fn() as any,
      update: jest.fn() as any,
      updateMany: jest.fn() as any,
    },
    userCoupon: {
      findMany: jest.fn() as any,
      count: jest.fn() as any,
      create: jest.fn() as any,
      updateMany: jest.fn() as any,
    },
    order: { count: jest.fn() as any },
    user: { findFirst: jest.fn() as any },
    $transaction: jest.fn() as any,
  };
}

describe('CouponService ownership guard', () => {
  let service: CouponService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    prisma.userCoupon.updateMany.mockResolvedValue({ count: 0 });
    service = new CouponService(prisma as any);
    jest.spyOn(service['logger'], 'log').mockImplementation(() => {});
  });

  it('findMyCoupons only queries coupons owned by current user', async () => {
    prisma.userCoupon.findMany.mockResolvedValue([]);
    prisma.userCoupon.count.mockResolvedValue(0);

    await service.findMyCoupons('100', COUPON_STATUS.FREE);

    expect(prisma.userCoupon.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ userId: 100n, status: COUPON_STATUS.FREE }),
      skip: 0,
      take: 10,
    }));
  });

  it('findMyCoupons returns an empty pagination shape when user has no coupons', async () => {
    prisma.userCoupon.findMany.mockResolvedValue([]);
    prisma.userCoupon.count.mockResolvedValue(0);

    const result = await service.findMyCoupons('100', 1, 1, 10);

    expect(result).toEqual({ list: [], total: 0, page: 1, pageSize: 10 });
  });

  it('findMyCoupons maps front tab status 2 and 3 to used and expired coupons', async () => {
    prisma.userCoupon.findMany.mockResolvedValue([]);
    prisma.userCoupon.count.mockResolvedValue(0);

    await service.findMyCoupons('100', 2);
    expect(prisma.userCoupon.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { userId: 100n, status: COUPON_STATUS.USED },
    }));

    await service.findMyCoupons('100', 3);
    expect(prisma.userCoupon.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId: 100n,
        OR: expect.arrayContaining([
          { status: COUPON_STATUS.EXPIRED },
        ]),
      }),
    }));
  });

  it('findUsable only returns current user unlocked coupons', async () => {
    prisma.userCoupon.findMany.mockResolvedValue([]);

    await service.findUsable('100', 5000);

    expect(prisma.userCoupon.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId: 100n,
        status: COUPON_STATUS.FREE,
        coupon: { minAmount: { lte: 5000 } },
      }),
    }));
  });
});
