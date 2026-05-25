import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { UserService } from './user.service';

function createMockPrisma() {
  return {
    user: {
      findFirst: jest.fn() as any,
      findMany: jest.fn() as any,
      count: jest.fn() as any,
      update: jest.fn() as any,
    },
    memberLevel: {
      findFirst: jest.fn() as any,
    },
    userMemberRecord: {
      create: jest.fn() as any,
    },
    order: {
      aggregate: jest.fn() as any,
    },
    pointsRecord: {
      findMany: jest.fn() as any,
    },
    $transaction: jest.fn((cb: any) => cb({})),
  };
}

describe('UserService', () => {
  let service: UserService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new UserService(prisma as any);
  });

  describe('getUserInfo', () => {
    it('should include avatar, memberLevelName, points compatibility fields', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 1n,
        openid: 'test_openid',
        phone: '13800138000',
        nickname: '测试用户',
        avatarUrl: 'https://example.com/avatar.jpg',
        gender: 1,
        memberLevelId: 2n,
        memberLevel: {
          id: 2n,
          name: '金卡会员',
          icon: 'gold.png',
          discountRate: 95,
          pointsRate: 30,
        },
        growthValue: 6000,
        totalPoints: 1000,
        availablePoints: 800,
        profile: null,
        lastLoginAt: new Date(),
        status: 1,
        createdAt: new Date(),
        _count: { babyProfiles: 1 },
      });

      const result = await service.getUserInfo('1');

      expect(result).toHaveProperty('avatar', 'https://example.com/avatar.jpg');
      expect(result).toHaveProperty('avatarUrl', 'https://example.com/avatar.jpg');
      expect(result).toHaveProperty('memberLevelName', '金卡会员');
      expect(result).toHaveProperty('points', 800);
      expect(result).toHaveProperty('availablePoints', 800);
      expect(result).toHaveProperty('memberLevel');
      expect(result.memberLevel!.name).toBe('金卡会员');
    });

    it('should default memberLevelName to "普通会员" when no memberLevel', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 1n,
        openid: 'test_openid',
        phone: '13800138000',
        nickname: '测试用户',
        avatarUrl: 'https://example.com/avatar.jpg',
        gender: 0,
        memberLevelId: null,
        memberLevel: null,
        growthValue: 0,
        totalPoints: 0,
        availablePoints: 0,
        profile: null,
        lastLoginAt: new Date(),
        status: 1,
        createdAt: new Date(),
        _count: { babyProfiles: 0 },
      });

      const result = await service.getUserInfo('1');

      expect(result.memberLevelName).toBe('普通会员');
      expect(result.points).toBe(0);
    });
  });
});
