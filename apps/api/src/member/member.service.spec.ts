import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { MemberService } from './member.service';

function createMockPrisma() {
  return {
    user: {
      findFirst: jest.fn() as any,
      update: jest.fn() as any,
    },
    memberLevel: {
      findMany: jest.fn() as any,
      findFirst: jest.fn() as any,
      create: jest.fn() as any,
      update: jest.fn() as any,
    },
    userMemberRecord: {
      create: jest.fn() as any,
    },
  };
}

const activeLevels = [
  {
    id: 1n,
    name: '普通会员',
    minGrowthValue: 0,
    maxGrowthValue: 999,
    discountRate: 100,
    pointsRate: 10,
    benefits: null,
    sortOrder: 0,
    status: 1,
  },
  {
    id: 2n,
    name: '银卡会员',
    minGrowthValue: 1000,
    maxGrowthValue: null,
    discountRate: 98,
    pointsRate: 12,
    benefits: null,
    sortOrder: 1000,
    status: 1,
  },
];

describe('MemberService weapp benefits', () => {
  let service: MemberService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    prisma.memberLevel.findMany.mockResolvedValue(activeLevels);
    service = new MemberService(prisma as any);
    jest.spyOn(service['logger'], 'log').mockImplementation(() => {});
  });

  it('getBenefits returns only capabilities that have real production execution paths', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 1n,
      growthValue: 0,
      memberLevelId: 1n,
      deletedAt: null,
    });

    const result = await service.getBenefits('1');

    expect(prisma.memberLevel.findMany).toHaveBeenCalledWith({
      where: { status: 1 },
      orderBy: [{ minGrowthValue: 'asc' }, { sortOrder: 'asc' }],
    });
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: expect.any(String),
        name: '会员价',
        icon: expect.stringMatching(/^\/static\//),
        description: expect.stringContaining('普通商品按会员价结算'),
        level: 0,
      }),
      expect.objectContaining({ name: '积分成长', description: expect.stringContaining('订单完成后') }),
      expect.objectContaining({ name: '会员专享券' }),
      expect.objectContaining({ name: '自动等级升级' }),
    ]));
    expect(result.map((item) => item.name)).not.toContain('售后优先');
    expect(result.map((item) => item.name)).not.toContain('生日/孕产期关怀');
  });

  it('historical system-generated unsupported defaults are mapped to truthful implemented rights', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 1n,
      growthValue: 0,
      memberLevelId: 1n,
      deletedAt: null,
    });
    prisma.memberLevel.findMany.mockResolvedValue([
      {
        ...activeLevels[0],
        maxGrowthValue: null,
        benefits: JSON.stringify([
          {
            id: 'priority_service_0',
            name: '售后优先',
            icon: '/static/tab/user-active.png',
            description: '售后咨询与处理优先响应',
            level: 0,
          },
          {
            id: 'care_0',
            name: '生日/孕产期关怀',
            icon: '/static/default-baby.png',
            description: '按宝宝生日或孕产阶段推送关怀福利',
            level: 0,
          },
        ]),
      },
    ]);

    const result = await service.getBenefits('1');

    expect(result).toEqual([
      expect.objectContaining({ id: 'member_coupon_0', name: '会员专享券' }),
      expect.objectContaining({ id: 'auto_upgrade_0', name: '自动等级升级' }),
    ]);
    expect(JSON.stringify(result)).not.toContain('优先响应');
    expect(JSON.stringify(result)).not.toContain('推送关怀福利');
  });

  it('getMemberInfo derives level thresholds and names from database configuration', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 1n,
      growthValue: 120,
      memberLevelId: 1n,
      memberLevel: activeLevels[0],
      deletedAt: null,
    });

    const result = await service.getMemberInfo('1');

    expect(result).toEqual(expect.objectContaining({
      level: 0,
      levelId: '1',
      levelName: '普通会员',
      growthValue: 120,
      currentLevelGrowth: 120,
      currentLevelMinGrowth: 0,
      nextLevelGrowth: 1000,
      rights: expect.arrayContaining(['会员价', '会员专享券', '自动等级升级']),
      currentLevel: '普通会员',
      currentLevelCode: 0,
      nextLevel: '银卡会员',
      growthGap: 880,
    }));
  });
});
