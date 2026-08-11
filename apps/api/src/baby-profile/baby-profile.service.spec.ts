import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { BabyProfileService } from './baby-profile.service';

function createMockPrisma() {
  const prisma: any = {
    babyProfile: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(async (callback: any) => callback(prisma));
  return prisma;
}

function babyProfile(overrides: Record<string, any> = {}) {
  return {
    id: 2n,
    userId: 1n,
    nickname: '小宝',
    gender: 1,
    birthday: new Date('2025-01-01T00:00:00.000Z'),
    avatarUrl: 'https://example.com/baby.png',
    isDefault: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

describe('BabyProfileService', () => {
  let service: BabyProfileService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    prisma.$queryRaw.mockResolvedValue([{ id: 1n }]);
    prisma.babyProfile.count.mockResolvedValue(0);
    prisma.babyProfile.findMany.mockResolvedValue([]);
    service = new BabyProfileService(prisma as any);
    jest.spyOn(service['logger'], 'log').mockImplementation(() => {});
  });

  it('should accept avatar alias on create and save it as avatarUrl', async () => {
    prisma.babyProfile.create.mockResolvedValue(babyProfile({ avatarUrl: 'https://example.com/new-baby.png', isDefault: 1 }));

    const result = await service.create('1', {
      nickname: '小宝',
      gender: 1,
      birthday: '2025-01-01',
      avatar: 'https://example.com/new-baby.png',
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(prisma.babyProfile.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          avatarUrl: 'https://example.com/new-baby.png',
        }),
      }),
    );
    expect(result.avatarUrl).toBe('https://example.com/new-baby.png');
    expect(result.avatar).toBe('https://example.com/new-baby.png');
  });

  it('should accept avatar alias on update and remove raw avatar before saving', async () => {
    prisma.babyProfile.findFirst.mockResolvedValue(babyProfile());
    prisma.babyProfile.findMany.mockResolvedValue([babyProfile({ isDefault: 1 })]);
    prisma.babyProfile.update.mockResolvedValue(babyProfile({ avatarUrl: 'https://example.com/edited-baby.png', isDefault: 1 }));

    const result = await service.update('1', '2', {
      avatar: 'https://example.com/edited-baby.png',
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(prisma.babyProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          avatarUrl: 'https://example.com/edited-baby.png',
        }),
      }),
    );
    expect(prisma.babyProfile.update.mock.calls[0][0].data).not.toHaveProperty('avatar');
    expect(result.avatar).toBe('https://example.com/edited-baby.png');
  });

  it('should return both avatarUrl and avatar for list items', async () => {
    prisma.babyProfile.findMany.mockResolvedValue([babyProfile({ avatarUrl: 'https://example.com/list-baby.png' })]);

    const result = await service.findAll('1');

    expect(result[0]).toMatchObject({
      id: '2',
      userId: '1',
      avatarUrl: 'https://example.com/list-baby.png',
      avatar: 'https://example.com/list-baby.png',
    });
  });
});