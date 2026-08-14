import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BabyProfileService } from './baby-profile.service';

function createPrismaMock() {
  return {
    babyProfile: {
      findMany: jest.fn() as any,
      count: jest.fn() as any,
    },
  };
}

describe('admin baby profile reporting contract', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: BabyProfileService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new BabyProfileService(prisma as any);
  });

  it('filters by the real nickname field and returns canonical profile fields', async () => {
    const createdAt = new Date('2026-08-13T00:00:00Z');
    const birthday = new Date('2026-01-01T00:00:00Z');
    prisma.babyProfile.findMany.mockResolvedValue([
      {
        id: 3n,
        userId: 7n,
        nickname: '安安',
        gender: 0,
        birthday,
        currentMonthAge: 7,
        avatarUrl: null,
        isDefault: 1,
        createdAt,
        updatedAt: createdAt,
        deletedAt: null,
        user: { id: 7n, nickname: '妈妈', phone: '13800138000' },
      },
    ]);
    prisma.babyProfile.count.mockResolvedValue(1);

    const result = await service.findAllAdmin({
      page: 1,
      pageSize: 10,
      skip: 0,
      take: 10,
      nickname: '安安',
      userId: '7',
    } as any);

    const expectedWhere = {
      deletedAt: null,
      nickname: { contains: '安安' },
      userId: 7n,
    };
    expect(prisma.babyProfile.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expectedWhere,
      include: { user: { select: { id: true, nickname: true, phone: true } } },
    }));
    expect(prisma.babyProfile.count).toHaveBeenCalledWith({ where: expectedWhere });

    const first = (result as any).list[0];
    expect(first).toMatchObject({
      id: '3',
      userId: '7',
      nickname: '安安',
      gender: 0,
      createdAt,
      user: { id: '7', nickname: '妈妈', phone: '13800138000' },
    });
    expect(first).not.toHaveProperty('name');
    expect(first).not.toHaveProperty('age');
    expect(first).not.toHaveProperty('dueDate');
    expect(first).not.toHaveProperty('remark');
  });
});
