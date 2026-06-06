import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { PointsService } from './points.service';

function createMockPrisma() {
  return {
    user: {
      findFirst: jest.fn() as any,
      update: jest.fn() as any,
    },
    pointsRecord: {
      findMany: jest.fn() as any,
      count: jest.fn() as any,
      findFirst: jest.fn() as any,
      create: jest.fn() as any,
    },
    $transaction: jest.fn() as any,
  };
}

describe('PointsService ownership guard', () => {
  let service: PointsService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    const redis = { set: jest.fn() };
    service = new PointsService(prisma as any, redis as any);
    jest.spyOn(service['logger'], 'log').mockImplementation(() => {});
  });

  it('getBalance only reads the current user id', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 100n, availablePoints: 10, totalPoints: 20 });

    const result = await service.getBalance('100');

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { id: 100n, deletedAt: null },
    });
    expect(result).toMatchObject({
      balance: 10,
      totalEarned: 20,
      totalSpent: 0,
      availablePoints: 10,
      totalPoints: 20,
      frozenPoints: 0,
    });
  });

  it('findByUser only queries current user points records', async () => {
    prisma.pointsRecord.findMany.mockResolvedValue([]);
    prisma.pointsRecord.count.mockResolvedValue(0);

    await service.findByUser('100', { page: 1, pageSize: 10, skip: 0, take: 10 } as any);

    expect(prisma.pointsRecord.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 100n },
    }));
    expect(prisma.pointsRecord.count).toHaveBeenCalledWith({
      where: { userId: 100n },
    });
  });

  it('getSignInStatus returns frontend aliases and original fields', async () => {
    prisma.pointsRecord.findFirst.mockResolvedValue(null);

    const result = await service.getSignInStatus('100');

    expect(result).toMatchObject({
      checked: false,
      continuous: 0,
      todayPoints: 5,
      todaySigned: false,
      consecutiveDays: 0,
      basePoints: 5,
      nextBonus: 5,
    });
  });

  it('signIn returns continuous alias after success', async () => {
    prisma.pointsRecord.findFirst.mockResolvedValue(null);
    prisma.user.findFirst.mockResolvedValue({ id: 100n, availablePoints: 10, totalPoints: 20 });
    prisma.$transaction.mockResolvedValue([]);
    jest.spyOn(service as any, 'getConsecutiveSignInDays').mockResolvedValue(2);

    const result = await service.signIn('100');

    expect(result).toMatchObject({
      alreadySigned: false,
      points: 9,
      continuous: 3,
      consecutiveDays: 3,
    });
  });

  it('getRules returns renderable rule array', async () => {
    const result = await service.getRules();

    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: '每日签到', points: 5, dailyLimit: 1 }),
      expect.objectContaining({ action: '积分抵扣', points: 0, dailyLimit: 0 }),
    ]));
  });
});
