import { DirectProfileCleanupScheduleService } from './direct-profile-cleanup-schedule.service';

describe('DirectProfileCleanupScheduleService', () => {
  it('runs a single cleanup batch only while holding the distributed lock', async () => {
    const redis = {
      setNX: jest.fn().mockResolvedValue(true),
      releaseLockWithLua: jest.fn().mockResolvedValue(true),
    } as any;
    const cleanup = {
      cleanupCancelledAccountsBatch: jest.fn().mockResolvedValue({ scanned: 2, deleted: 2, failed: [] }),
    } as any;
    const service = new DirectProfileCleanupScheduleService(redis, cleanup);

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
      setNX: jest.fn().mockResolvedValue(false),
      releaseLockWithLua: jest.fn(),
    } as any;
    const cleanup = { cleanupCancelledAccountsBatch: jest.fn() } as any;
    const service = new DirectProfileCleanupScheduleService(redis, cleanup);

    await service.handleCancelledProfileAssets();

    expect(cleanup.cleanupCancelledAccountsBatch).not.toHaveBeenCalled();
    expect(redis.releaseLockWithLua).not.toHaveBeenCalled();
  });
});
