import 'reflect-metadata';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { AtomicMemberService } from './atomic-member.service';
import { MemberModule } from './member.module';
import { MemberService } from './member.service';

function createPrismaMock() {
  const tx: any = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: 1n }, { id: 2n }]),
    memberLevel: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    user: {
      updateMany: jest.fn(),
    },
    userMemberRecord: {
      create: jest.fn(),
    },
  };
  const prisma: any = {
    ...tx,
    user: {
      findMany: jest.fn(),
      updateMany: tx.user.updateMany,
    },
    userMemberRecord: tx.userMemberRecord,
    $transaction: jest.fn(async (callback: any) => callback(tx)),
  };
  return { prisma, tx };
}

describe('AtomicMemberService', () => {
  it('rejects an invalid range inside the same transaction without compensation writes', async () => {
    const { prisma, tx } = createPrismaMock();
    tx.memberLevel.findUnique.mockResolvedValue({
      id: 1n,
      name: '普通会员',
      icon: null,
      minGrowthValue: 0,
      maxGrowthValue: 999,
      discountRate: null,
      pointsRate: 10,
      benefits: null,
      sortOrder: 1,
      status: 1,
    });
    tx.memberLevel.update.mockResolvedValue({ id: 1n });
    tx.memberLevel.findMany.mockResolvedValue([
      {
        id: 1n,
        name: '普通会员',
        minGrowthValue: 0,
        maxGrowthValue: 500,
        sortOrder: 1,
        status: 1,
      },
      {
        id: 2n,
        name: '银卡会员',
        minGrowthValue: 1000,
        maxGrowthValue: null,
        sortOrder: 2,
        status: 1,
      },
    ]);
    const service = new AtomicMemberService(prisma);

    await expect(service.updateLevel('1', { maxGrowthValue: 500 })).rejects.toThrow(
      '会员等级区间必须连续且不重叠',
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.memberLevel.update).toHaveBeenCalledTimes(1);
    expect(tx.memberLevel.update).toHaveBeenCalledWith({
      where: { id: 1n },
      data: { maxGrowthValue: 500 },
    });
  });

  it('does not restore a membership level when account cancellation wins reconciliation', async () => {
    const { prisma, tx } = createPrismaMock();
    prisma.memberLevel.findMany.mockResolvedValue([
      {
        id: 10n,
        name: '普通会员',
        minGrowthValue: 0,
        maxGrowthValue: null,
        sortOrder: 1,
        status: 1,
      },
    ]);
    prisma.user.findMany.mockResolvedValue([
      { id: 7n, growthValue: 0, memberLevelId: null },
    ]);
    tx.user.updateMany.mockResolvedValue({ count: 0 });
    const service = new AtomicMemberService(prisma);

    await (service as any).reconcileUsersAfterLevelChange();

    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: 7n, deletedAt: null, memberLevelId: null },
      data: { memberLevelId: 10n },
    });
    expect(tx.userMemberRecord.create).not.toHaveBeenCalled();
  });

  it('binds MemberService to the atomic production provider', () => {
    const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, MemberModule) as any[];
    const binding = providers.find((provider) => provider?.provide === MemberService);
    expect(binding?.useClass).toBe(AtomicMemberService);
  });
});
