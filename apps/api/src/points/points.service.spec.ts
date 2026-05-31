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

    await service.getBalance('100');

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { id: 100n, deletedAt: null },
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
});
