import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { OrderStatus } from '@prisma/client';
import { UserService } from './user.service';

function createMockPrisma() {
  return {
    user: {
      findFirst: jest.fn() as any,
      findMany: jest.fn() as any,
      count: jest.fn() as any,
    },
    order: {
      groupBy: jest.fn() as any,
      aggregate: jest.fn() as any,
      findMany: jest.fn() as any,
    },
    pointsRecord: {
      findMany: jest.fn() as any,
    },
  };
}

function createUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 7n,
    openid: 'openid-production-secret',
    unionId: 'unionid-production-secret',
    phone: '13800138000',
    nickname: '测试用户',
    avatarUrl: '/uploads/public/avatar.jpg',
    gender: 0,
    memberLevelId: null,
    memberLevel: null,
    growthValue: 0,
    totalPoints: 100,
    availablePoints: 80,
    profile: null,
    lastLoginAt: new Date('2026-08-13T00:00:00Z'),
    status: 1,
    createdAt: new Date('2026-08-01T00:00:00Z'),
    _count: { babyProfiles: 1 },
    ...overrides,
  };
}

describe('admin user reporting contract', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let service: UserService;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new UserService(prisma as any);
  });

  it('returns page-level paid-order statistics without exposing raw WeChat identifiers', async () => {
    prisma.user.findMany.mockResolvedValue([createUser()]);
    prisma.user.count.mockResolvedValue(1);
    prisma.order.groupBy.mockResolvedValue([
      {
        userId: 7n,
        _sum: { payAmount: 12345 },
        _count: { _all: 2 },
      },
    ]);

    const result = await service.findAll({
      page: 1,
      pageSize: 10,
      skip: 0,
      take: 10,
    } as any);

    expect(prisma.order.groupBy).toHaveBeenCalledWith(expect.objectContaining({
      by: ['userId'],
      where: expect.objectContaining({
        userId: { in: [7n] },
        status: {
          in: [
            OrderStatus.paid,
            OrderStatus.pending_delivery,
            OrderStatus.pending_pickup,
            OrderStatus.delivered,
            OrderStatus.completed,
          ],
        },
      }),
    }));
    expect(result.list[0]).toMatchObject({
      id: '7',
      orderCount: 2,
      totalSpent: 12345,
      babyCount: 1,
    });
    expect(result.list[0]).not.toHaveProperty('balance');
    expect(result.list[0]).not.toHaveProperty('openid');
    expect(result.list[0]).not.toHaveProperty('unionId');
    expect(result.list[0].openidMasked).toContain('****');
    expect(result.list[0].unionIdMasked).toContain('****');
  });

  it('returns authoritative detail metrics and recent orders expected by the admin page', async () => {
    const createdAt = new Date('2026-08-12T03:00:00Z');
    prisma.user.findFirst.mockResolvedValue(createUser({
      babyProfiles: [
        {
          id: 3n,
          userId: 7n,
          nickname: null,
          gender: 0,
          birthday: new Date('2026-01-01T00:00:00Z'),
          currentMonthAge: 7,
          avatarUrl: null,
          isDefault: 1,
        },
      ],
      _count: { pointsRecords: 0 },
    }));
    prisma.order.aggregate.mockResolvedValue({
      _sum: { payAmount: 9000 },
      _count: 2,
    });
    prisma.order.findMany.mockResolvedValue([
      {
        id: 99n,
        orderNo: 'O202608120001',
        status: OrderStatus.completed,
        totalAmount: 10000,
        payAmount: 8000,
        createdAt,
      },
    ]);
    prisma.pointsRecord.findMany.mockResolvedValue([]);

    const result = await service.findOne('7');

    expect(result).toMatchObject({
      id: '7',
      orderCount: 2,
      totalSpent: 9000,
      avgOrderAmount: 4500,
      orderStats: { totalOrders: 2, totalAmount: 9000 },
    });
    expect(result.recentOrders).toEqual([
      {
        id: '99',
        orderNo: 'O202608120001',
        status: OrderStatus.completed,
        totalAmount: 8000,
        createTime: createdAt,
      },
    ]);
    expect(result).not.toHaveProperty('balance');
    expect(result).not.toHaveProperty('openid');
    expect(result).not.toHaveProperty('unionId');
  });
});
