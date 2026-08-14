import 'reflect-metadata';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { AtomicMemberService } from './atomic-member.service';
import { MemberModule } from './member.module';
import { MemberService } from './member.service';

const VALID_LEVEL = {
  id: 1n,
  name: '普通会员',
  icon: null,
  minGrowthValue: 0,
  maxGrowthValue: null,
  discountRate: null,
  pointsRate: 10,
  benefits: null,
  sortOrder: 1,
  status: 1,
};

function createPrismaMock() {
  const businessEvent = {
    findFirst: jest.fn(),
    create: jest.fn(),
  };
  const user = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    updateMany: jest.fn(),
    update: jest.fn(),
  };
  const tx: any = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: 1n }, { id: 2n }]),
    memberLevel: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    user,
    userMemberRecord: {
      create: jest.fn(),
    },
    businessEvent,
  };
  const prisma: any = {
    ...tx,
    $transaction: jest.fn(async (callback: any) => callback(tx)),
  };
  return { prisma, tx };
}

describe('AtomicMemberService', () => {
  it('rejects an invalid range inside the same transaction without publishing a reconcile request', async () => {
    const { prisma, tx } = createPrismaMock();
    tx.memberLevel.findUnique.mockResolvedValue({
      ...VALID_LEVEL,
      maxGrowthValue: 999,
    });
    tx.memberLevel.update.mockResolvedValue({ id: 1n });
    tx.memberLevel.findMany.mockResolvedValue([
      {
        ...VALID_LEVEL,
        maxGrowthValue: 500,
      },
      {
        ...VALID_LEVEL,
        id: 2n,
        name: '银卡会员',
        minGrowthValue: 1000,
        sortOrder: 2,
      },
    ]);
    const service = new AtomicMemberService(prisma);

    await expect(service.updateLevel('1', { maxGrowthValue: 500 })).rejects.toThrow(
      '会员等级区间必须连续且不重叠',
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.memberLevel.update).toHaveBeenCalledWith({
      where: { id: 1n },
      data: { maxGrowthValue: 500 },
    });
    expect(tx.businessEvent.create).not.toHaveBeenCalled();
  });

  it('publishes the durable reconcile request before post-commit reconciliation starts', async () => {
    const { prisma, tx } = createPrismaMock();
    tx.memberLevel.findUnique.mockResolvedValue(VALID_LEVEL);
    tx.memberLevel.update.mockResolvedValue(VALID_LEVEL);
    tx.memberLevel.findMany.mockResolvedValue([VALID_LEVEL]);
    tx.businessEvent.create.mockResolvedValue({ id: 55n });
    const service = new AtomicMemberService(prisma);
    const reconcile = jest.spyOn(service, 'reconcilePendingLevelConfiguration').mockResolvedValue({
      status: 'completed',
      generationId: '55',
      batches: 1,
      scanned: 0,
      updated: 0,
    });

    await service.updateLevel('1', { name: '普通会员' });

    expect(tx.businessEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: 'member_level_reconcile_requested',
        bizType: 'member_level_config',
        bizId: '1',
        payload: expect.objectContaining({ action: 'update', levelId: '1' }),
      }),
    });
    expect(tx.businessEvent.create.mock.invocationCallOrder[0]).toBeLessThan(
      reconcile.mock.invocationCallOrder[0],
    );
  });

  it('does not restore a membership level when account cancellation or growth mutation wins the CAS', async () => {
    const { prisma, tx } = createPrismaMock();
    tx.businessEvent.findFirst.mockImplementation(({ where }: any) => {
      if (where.eventType === 'member_level_reconcile_requested') return Promise.resolve({ id: 55n });
      return Promise.resolve(null);
    });
    tx.memberLevel.findMany.mockResolvedValue([{ ...VALID_LEVEL, id: 10n }]);
    tx.user.findMany.mockResolvedValue([
      { id: 7n, growthValue: 12, memberLevelId: null },
    ]);
    tx.user.updateMany.mockResolvedValue({ count: 0 });
    tx.businessEvent.create.mockResolvedValue({ id: 56n });
    const service = new AtomicMemberService(prisma);

    const result = await service.reconcilePendingLevelConfiguration(1);

    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: {
        id: 7n,
        deletedAt: null,
        growthValue: 12,
        memberLevelId: null,
      },
      data: { memberLevelId: 10n },
    });
    expect(tx.userMemberRecord.create).not.toHaveBeenCalled();
    expect(result.status).toBe('completed');
    expect(tx.businessEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: 'member_level_reconcile_completed',
        bizId: '55',
      }),
    });
  });

  it('locks the member-level configuration before reading the user for a growth-driven upgrade', async () => {
    const { prisma, tx } = createPrismaMock();
    tx.memberLevel.findMany.mockResolvedValue([
      { ...VALID_LEVEL, id: 10n, maxGrowthValue: 99 },
      { ...VALID_LEVEL, id: 20n, name: '银卡会员', minGrowthValue: 100, sortOrder: 2 },
    ]);
    tx.user.findUnique.mockResolvedValue({
      id: 7n,
      growthValue: 120,
      memberLevelId: 10n,
      deletedAt: null,
    });
    tx.user.update.mockResolvedValue({ id: 7n });
    tx.userMemberRecord.create.mockResolvedValue({ id: 1n });
    const service = new AtomicMemberService(prisma);

    await service.checkAndUpgradeLevel('7');

    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(tx.memberLevel.findMany.mock.invocationCallOrder[0]).toBeLessThan(
      tx.user.findUnique.mock.invocationCallOrder[0],
    );
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 7n },
      data: { memberLevelId: 20n },
    });
    expect(tx.userMemberRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 7n,
        oldLevelId: 10n,
        newLevelId: 20n,
      }),
    });
  });

  it('binds MemberService to the atomic production provider', () => {
    const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, MemberModule) as any[];
    const binding = providers.find((provider) => provider?.provide === MemberService);
    expect(binding?.useClass).toBe(AtomicMemberService);
  });
});
