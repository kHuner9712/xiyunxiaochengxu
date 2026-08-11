import { AuthoritativeCouponReportingService } from './authoritative-coupon-reporting.service';
import { COUPON_STATUS } from '../common/constants/payment';

function createPrismaMock() {
  const prisma: any = {
    coupon: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    userCoupon: {
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    userInviteReward: { count: jest.fn() },
    shareCampaign: { findMany: jest.fn() },
    $queryRaw: jest.fn(),
  };
  prisma.$transaction = jest.fn(async (callback: any) => callback(prisma));
  return prisma;
}

const couponRow = (id: bigint, usedCount = 99) => ({
  id,
  name: `券${id}`,
  type: 1,
  value: 100,
  minAmount: 0,
  discountLimit: 0,
  totalCount: 100,
  receivedCount: 5,
  usedCount,
  perLimit: 1,
  startTime: new Date('2026-01-01T00:00:00Z'),
  endTime: new Date('2027-01-01T00:00:00Z'),
  validDays: 0,
  applicableType: 0,
  applicableIds: { ids: [], description: '' },
  memberLevelId: null,
  isNewUser: 0,
  status: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('AuthoritativeCouponReportingService', () => {
  it('overrides stale cached usedCount in admin list from USED holdings', async () => {
    const prisma = createPrismaMock();
    prisma.coupon.findMany.mockResolvedValue([couponRow(7n), couponRow(8n)]);
    prisma.coupon.count.mockResolvedValue(2);
    prisma.userCoupon.groupBy.mockResolvedValue([
      { couponId: 7n, _count: { _all: 2 } },
    ]);
    const service = new AuthoritativeCouponReportingService(prisma);

    const result = await service.findAllAdmin({
      page: 1,
      pageSize: 20,
      skip: 0,
      take: 20,
    } as any);

    expect(prisma.userCoupon.groupBy).toHaveBeenCalledWith({
      by: ['couponId'],
      where: {
        couponId: { in: [7n, 8n] },
        status: COUPON_STATUS.USED,
      },
      _count: { _all: true },
    });
    expect(result.list.map((item: any) => [item.id, item.usedCount])).toEqual([
      ['7', 2],
      ['8', 0],
    ]);
  });

  it('overrides stale cached usedCount in admin detail from USED holdings', async () => {
    const prisma = createPrismaMock();
    prisma.coupon.findUnique.mockResolvedValue(couponRow(7n));
    prisma.userCoupon.count.mockResolvedValue(3);
    const service = new AuthoritativeCouponReportingService(prisma);

    const result = await service.findById('7');

    expect(prisma.userCoupon.count).toHaveBeenCalledWith({
      where: { couponId: 7n, status: COUPON_STATUS.USED },
    });
    expect(result.usedCount).toBe(3);
  });
});
