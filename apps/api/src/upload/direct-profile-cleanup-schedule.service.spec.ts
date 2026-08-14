import { describe, it, expect, jest } from '@jest/globals';

jest.mock('@nestjs/schedule', () => ({
  Cron: () => () => {},
}));

import { DirectProfileCleanupScheduleService } from './direct-profile-cleanup-schedule.service';

describe('DirectProfileCleanupScheduleService', () => {
  it('runs a single cleanup batch only while holding the distributed lock', async () => {
    const redis = {
      setNX: jest.fn().mockResolvedValue(true as never),
      releaseLockWithLua: jest.fn().mockResolvedValue(true as never),
    } as any;
    const cleanup = {
      cleanupCancelledAccountsBatch: jest.fn().mockResolvedValue({ scanned: 2, deleted: 2, failed: [] } as never),
    } as any;
    const service = new DirectProfileCleanupScheduleService(redis, cleanup);
    jest.spyOn((service as any).logger, 'log').mockImplementation(() => {});
    jest.spyOn((service as any).logger, 'warn').mockImplementation(() => {});
    jest.spyOn((service as any).logger, 'error').mockImplementation(() => {});

    await service.handleCancelledProfileAssets();

    expect(redis.setNX).toHaveBeenCalledWith(
      'schedule:direct_profile_cancelled_cleanup',
      expect.any(String),
      1800,
    );
    expect(cleanup.cleanupCancelledAccountsBatch).toHaveBeenCalledWith(200);
    expect(redis.releaseLockWithLua).toHaveBeenCalledWith(
      'schedule:direct_profile_cancelled_cleanup',
      expect.any(String),
    );
  });

  it('does nothing when another replica owns the lock', async () => {
    const redis = {
      setNX: jest.fn().mockResolvedValue(false as never),
      releaseLockWithLua: jest.fn(),
    } as any;
    const cleanup = { cleanupCancelledAccountsBatch: jest.fn() } as any;
    const service = new DirectProfileCleanupScheduleService(redis, cleanup);

    await service.handleCancelledProfileAssets();

    expect(cleanup.cleanupCancelledAccountsBatch).not.toHaveBeenCalled();
    expect(redis.releaseLockWithLua).not.toHaveBeenCalled();
  });
});
