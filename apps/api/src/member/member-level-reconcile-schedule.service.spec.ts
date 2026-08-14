import { MemberLevelReconcileScheduleService } from './member-level-reconcile-schedule.service';

describe('MemberLevelReconcileScheduleService', () => {
  it('uses a distributed lock and runs a bounded recovery batch', async () => {
    const redis: any = {
      setNX: jest.fn().mockResolvedValue(true),
      extendLockWithLua: jest.fn().mockResolvedValue(true),
      releaseLockWithLua: jest.fn().mockResolvedValue(true),
    };
    const memberService: any = {
      reconcilePendingLevelConfiguration: jest.fn().mockResolvedValue({
        status: 'pending',
        generationId: '99',
        batches: 20,
        scanned: 2000,
        updated: 10,
      }),
    };
    const service = new MemberLevelReconcileScheduleService(redis, memberService);

    await service.handleMemberLevelReconcile();

    expect(redis.setNX).toHaveBeenCalledWith('schedule:member_level_reconcile', expect.any(String), 120);
    expect(memberService.reconcilePendingLevelConfiguration).toHaveBeenCalledWith(20);
    expect(redis.releaseLockWithLua).toHaveBeenCalledWith(
      'schedule:member_level_reconcile',
      expect.any(String),
    );
  });

  it('does not start a recovery run after shutdown begins', async () => {
    const redis: any = {
      setNX: jest.fn(),
      extendLockWithLua: jest.fn(),
      releaseLockWithLua: jest.fn(),
    };
    const memberService: any = {
      reconcilePendingLevelConfiguration: jest.fn(),
    };
    const service = new MemberLevelReconcileScheduleService(redis, memberService);

    await service.onModuleDestroy();
    await service.handleMemberLevelReconcile();

    expect(redis.setNX).not.toHaveBeenCalled();
    expect(memberService.reconcilePendingLevelConfiguration).not.toHaveBeenCalled();
  });
});
