import { describe, expect, it, jest } from '@jest/globals';
import { ProductionPointsService } from './production-points.service';

function createService(findFirstResults: any[]) {
  const findFirst = jest.fn<any>();
  for (const result of findFirstResults) findFirst.mockResolvedValueOnce(result);

  const prisma: any = {
    pointsRecord: { findFirst },
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
  };
}

describe('ProductionPointsService sign-in status', () => {
  it('当天已签到时连续天数包含今天', async () => {
    const { service } = createService([
      { id: 10n, points: 9 }, // today
      { id: 9n }, // yesterday
      { id: 8n }, // two days ago
      null,
    ]);

    const result = await service.getSignInStatus('100');

    expect(result).toMatchObject({
      checked: true,
      todaySigned: true,
      continuous: 3,
      consecutiveDays: 3,
    });
  });

  it('重复签到命中幂等分支时返回真实连续天数而不是0', async () => {
    const { service, redis } = createService([
      { id: 10n, points: 9 }, // signIn transaction sees today already signed
      { id: 10n, points: 9 }, // getSignInStatus today
      { id: 9n },
      { id: 8n },
      null,
    ]);

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
