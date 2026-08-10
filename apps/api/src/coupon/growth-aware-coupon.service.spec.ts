import { GrowthAwareCouponService } from './growth-aware-coupon.service';

describe('GrowthAwareCouponService', () => {
  it('成长值已升级但持久化等级仍旧时，先修复等级再返回新等级专属券', async () => {
    const levelUpdate = jest.fn(async () => ({}));
    const memberRecordCreate = jest.fn(async () => ({}));
    const levels = [
      { id: 1n, name: '普通会员', minGrowthValue: 0, maxGrowthValue: 99, discountRate: 100, pointsRate: 10, sortOrder: 1, status: 1 },
      { id: 2n, name: '银卡会员', minGrowthValue: 100, maxGrowthValue: null, discountRate: 90, pointsRate: 15, sortOrder: 2, status: 1 },
    ];
    const tx: any = {
      $queryRaw: jest.fn(async () => [{ id: 7n }]),
      user: {
        findFirst: jest.fn(async () => ({ growthValue: 150, memberLevelId: 1n })),
        update: levelUpdate,
      },
      memberLevel: { findMany: jest.fn(async () => levels) },
      userMemberRecord: { create: memberRecordCreate },
    };
    const prisma: any = {
      $transaction: jest.fn(async (callback: any) => callback(tx)),
      user: {
        findFirst: jest.fn(async () => ({ id: 7n, memberLevelId: 2n })),
      },
      memberLevel: { findMany: jest.fn(async () => levels) },
      coupon: {
        findMany: jest.fn(async () => [{
          id: 20n,
          name: '银卡会员券',
          type: 1,
          value: 1000,
          minAmount: 5000,
          discountLimit: 0,
          totalCount: 100,
          receivedCount: 0,
          usedCount: 0,
          perLimit: 1,
          startTime: new Date(Date.now() - 60_000),
          endTime: new Date(Date.now() + 60_000),
          validDays: 0,
          applicableType: 0,
          applicableIds: { ids: [], description: '' },
          memberLevelId: 2n,
          isNewUser: 0,
          status: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        }]),
      },
      order: { count: jest.fn(async () => 1) },
      userCoupon: { count: jest.fn(async () => 0) },
    };

    const service = new GrowthAwareCouponService(prisma);
    const result: any[] = await service.findAvailable('7');

    expect(levelUpdate).toHaveBeenCalledWith({
      where: { id: 7n },
      data: { memberLevelId: 2n },
    });
    expect(memberRecordCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 7n, oldLevelId: 1n, newLevelId: 2n }),
    });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('银卡会员券');
  });
});
