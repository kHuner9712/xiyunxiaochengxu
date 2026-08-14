import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ProductionPointsService } from './production-points.service';

const NOW = new Date('2026-08-10T04:00:00.000Z'); // 2026-08-10 12:00 China time
const DAY_MS = 24 * 60 * 60 * 1000;

function day(offset: number) {
  return new Date(NOW.getTime() + offset * DAY_MS);
}

function createService(findFirstResults: any[], history: Date[]) {
  const findFirst = jest.fn<any>();
  for (const result of findFirstResults) findFirst.mockResolvedValueOnce(result);

  const findMany = jest.fn<any>().mockResolvedValue(
    history.map((createdAt) => ({ createdAt })),
  );

  const prisma: any = {
    pointsRecord: { findFirst, findMany },
    $queryRaw: jest.fn<any>().mockResolvedValue([{ id: 100n }]),
    $transaction: jest.fn(async (callback: any) => callback(prisma)),
  };
  const redis: any = {
    setNX: jest.fn(async () => true),
    releaseLockWithLua: jest.fn(async () => true),
  };
  return {
    service: new ProductionPointsService(prisma, redis),
    prisma,
    redis,
    findFirst,
    findMany,
  };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('ProductionPointsService sign-in status', () => {
  it('当天已签到时连续天数包含今天', async () => {
    const { service } = createService(
      [
        { id: 10n, points: 9 }, // base status: today
        { id: 9n }, // base status: yesterday
        { id: 8n }, // base status: two days ago
        null,
      ],
      [day(0), day(-1), day(-2)],
    );

    const result = await service.getSignInStatus('100');

    expect(result).toMatchObject({
      checked: true,
      todaySigned: true,
      continuous: 3,
      consecutiveDays: 3,
    });
  });

  it('连续签到超过30天时返回真实天数，不再被历史扫描上限截断', async () => {
    const baseFindFirstResults = [
      { id: 100n, points: 20 }, // today
      ...Array.from({ length: 30 }, (_, index) => ({ id: BigInt(99 - index) })),
    ];
    const fullHistory = Array.from({ length: 46 }, (_, index) => day(-index));
    const { service, findMany } = createService(baseFindFirstResults, fullHistory);

    const result = await service.getSignInStatus('100');

    expect(result.todaySigned).toBe(true);
    expect(result.continuous).toBe(46);
    expect(result.consecutiveDays).toBe(46);
    expect(findMany).toHaveBeenCalledWith({
      where: { userId: 100n, source: 'sign_in', type: 1 },
      select: { createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('重复签到命中幂等分支时返回真实连续天数而不是0', async () => {
    const { service, redis } = createService(
      [
        { id: 10n, points: 9 }, // signIn transaction sees today already signed
        { id: 10n, points: 9 }, // getSignInStatus today
        { id: 9n },
        { id: 8n },
        null,
      ],
      [day(0), day(-1), day(-2)],
    );

    const result = await service.signIn('100');

    expect(result).toMatchObject({
      alreadySigned: true,
      points: 0,
      continuous: 3,
      consecutiveDays: 3,
    });
    expect(redis.releaseLockWithLua).toHaveBeenCalled();
  });
});
