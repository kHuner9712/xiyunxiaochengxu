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

describe('MemberService weapp benefits', () => {
  let service: MemberService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new MemberService(prisma as any);
    jest.spyOn(service['logger'], 'log').mockImplementation(() => {});
  });

  it('getBenefits returns front-end MemberRight array for ordinary users without seeded benefits', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 1n,
      growthValue: 0,
      memberLevel: { id: 1n, benefits: null },
      deletedAt: null,
    });

    const result = await service.getBenefits('1');

    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: expect.any(String),
        name: '会员价',
        icon: expect.stringMatching(/^\/static\//),
        description: expect.any(String),
        level: 0,
      }),
      expect.objectContaining({ name: '积分成长' }),
      expect.objectContaining({ name: '售后优先' }),
      expect.objectContaining({ name: '生日/孕产期关怀' }),
    ]));
  });

  it('getMemberInfo keeps legacy fields and adds miniprogram-compatible fields', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 1n,
      growthValue: 120,
      memberLevel: { id: 1n, benefits: null },
      deletedAt: null,
    });

    const result = await service.getMemberInfo('1');

    expect(result).toEqual(expect.objectContaining({
      level: 0,
      levelName: '普通会员',
      growthValue: 120,
      currentLevelGrowth: 120,
      nextLevelGrowth: 1000,
      rights: expect.arrayContaining(['会员价']),
      currentLevel: '普通会员',
      currentLevelCode: 0,
    }));
  });
});
