import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.mock('@nestjs/schedule', () => ({
  Cron: () => () => {},
}));

import { PointsExpiryScheduleService } from './points-expiry-schedule.service';

function createRedisService() {
  return {
    setNX: jest.fn(),
    releaseLockWithLua: jest.fn(),
  };
}

function createPointsService() {
  return {
    cleanExpiredPoints: jest.fn(),
  };
}

describe('PointsExpiryScheduleService', () => {
  let redisService: ReturnType<typeof createRedisService>;
  let pointsService: ReturnType<typeof createPointsService>;
  let service: PointsExpiryScheduleService;

  beforeEach(() => {
    redisService = createRedisService();
    pointsService = createPointsService();
    redisService.setNX.mockResolvedValue(true as never);
    redisService.releaseLockWithLua.mockResolvedValue(true as never);
    pointsService.cleanExpiredPoints.mockResolvedValue({
      cleanedCount: 2,
      skippedCount: 0,
      deductedPoints: 30,
    } as never);
    service = new PointsExpiryScheduleService(redisService as any, pointsService as any);
    jest.spyOn((service as any).logger, 'log').mockImplementation(() => {});
    jest.spyOn((service as any).logger, 'warn').mockImplementation(() => {});
    jest.spyOn((service as any).logger, 'error').mockImplementation(() => {});
  });

  it('automatically executes FIFO points expiry behind a distributed lock', async () => {
    await service.handleExpiredPoints();

    expect(redisService.setNX).toHaveBeenCalledWith(
      'schedule:points_expiry_cleanup',
      expect.any(String),
      1800,
    );
    expect(pointsService.cleanExpiredPoints).toHaveBeenCalledTimes(1);
    expect(redisService.releaseLockWithLua).toHaveBeenCalledWith(
      'schedule:points_expiry_cleanup',
      expect.any(String),
    );
  });

  it('does not execute cleanup when another API replica owns the lock', async () => {
    redisService.setNX.mockResolvedValue(false as never);

    await service.handleExpiredPoints();

    expect(pointsService.cleanExpiredPoints).not.toHaveBeenCalled();
    expect(redisService.releaseLockWithLua).not.toHaveBeenCalled();
  });

  it('waits for an in-flight cleanup during shutdown and refuses later runs', async () => {
    let resolveCleanup: (value: any) => void = () => undefined;
    pointsService.cleanExpiredPoints.mockImplementation(
      () => new Promise((resolve) => { resolveCleanup = resolve; }) as any,
    );

    const running = service.handleExpiredPoints();
    await Promise.resolve();
    await Promise.resolve();

    let shutdownFinished = false;
    const shutdown = service.onModuleDestroy().then(() => {
      shutdownFinished = true;
    });
    await Promise.resolve();
    expect(shutdownFinished).toBe(false);

    resolveCleanup({ cleanedCount: 1, deductedPoints: 5 });
    await running;
    await shutdown;
    expect(shutdownFinished).toBe(true);

    const callsBefore = redisService.setNX.mock.calls.length;
    await service.handleExpiredPoints();
    expect(redisService.setNX).toHaveBeenCalledTimes(callsBefore);
  });
});
