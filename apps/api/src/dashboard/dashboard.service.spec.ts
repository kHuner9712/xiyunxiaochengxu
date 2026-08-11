import { BadRequestException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { DashboardService } from './dashboard.service';

function createMockPrisma() {
  return {
    order: {
      aggregate: jest.fn() as any,
      count: jest.fn() as any,
      findMany: jest.fn() as any,
    },
    orderItem: {
      groupBy: jest.fn() as any,
    },
    user: {
      count: jest.fn() as any,
    },
    product: {
      count: jest.fn() as any,
      findMany: jest.fn() as any,
    },
    aftersaleOrder: {
      count: jest.fn() as any,
    },
  };
}

describe('DashboardService production contracts', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let service: DashboardService;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new DashboardService(prisma as any);
  });

  it('returns the flat admin overview contract using one consistent paid-order definition', async () => {
    prisma.order.aggregate
      .mockResolvedValueOnce({ _sum: { payAmount: 10_000 }, _count: 2 })
      .mockResolvedValueOnce({ _sum: { payAmount: 5_000 }, _count: 1 })
      .mockResolvedValueOnce({ _sum: { payAmount: 50_000 }, _count: 10 });
    prisma.user.count
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(20)
      .mockResolvedValueOnce(100);
    prisma.order.count
      .mockResolvedValueOnce(200)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(5);
    prisma.product.count
      .mockResolvedValueOnce(80)
      .mockResolvedValueOnce(60);
    prisma.aftersaleOrder.count.mockResolvedValueOnce(7);

    const result = await service.getStats();

    expect(result).toEqual(expect.objectContaining({
      todaySales: 10_000,
      todayOrders: 2,
      todayUsers: 4,
      totalProducts: 80,
      onSaleProducts: 60,
      salesGrowth: 100,
      orderGrowth: 100,
      userGrowth: 100,
    }));
    expect(result.today).toEqual(expect.objectContaining({ salesAmount: 10_000, orderCount: 2 }));
    expect(result.growth).toEqual(expect.objectContaining({ orderGrowth: 100, userGrowth: 100 }));

    const todaySalesQuery = prisma.order.aggregate.mock.calls[0][0];
    expect(todaySalesQuery.where.status.in).toContain(OrderStatus.paid);
    expect(todaySalesQuery.where.paidAt).toBeDefined();
  });

  it('returns salesAmount and orderCount from the same paid-order aggregate per day', async () => {
    prisma.order.aggregate
      .mockResolvedValueOnce({ _sum: { payAmount: 12_000 }, _count: 3 })
      .mockResolvedValueOnce({ _sum: { payAmount: 8_000 }, _count: 2 });

    const result = await service.getSalesChartByDateRange('2026-08-08', '2026-08-09');

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(expect.objectContaining({
      date: '2026-08-08',
      orderCount: 3,
      salesAmount: 12_000,
      revenue: 12_000,
    }));
    expect(prisma.order.aggregate).toHaveBeenCalledTimes(2);
    expect(prisma.order.aggregate.mock.calls[0][0].where.status.in).toContain(OrderStatus.paid);
  });

  it('rejects dashboard trend ranges that could amplify database load', async () => {
    await expect(
      service.getSalesChartByDateRange('2026-07-01', '2026-08-01'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.order.aggregate).not.toHaveBeenCalled();
  });

  it('builds top products from paid order-item sales instead of product list placeholders', async () => {
    prisma.orderItem.groupBy.mockResolvedValue([
      { productId: 11n, _sum: { quantity: 5, subtotal: 25_000 } },
      { productId: 22n, _sum: { quantity: 3, subtotal: 18_000 } },
    ]);
    prisma.product.findMany.mockResolvedValue([
      { id: 11n, name: '商品A', mainImage: null, totalSales: 5, minPrice: 5_000 },
      { id: 22n, name: '商品B', mainImage: null, totalSales: 3, minPrice: 6_000 },
    ]);

    const result = await service.getTopProducts(10);

    expect(result).toEqual([
      expect.objectContaining({ id: '11', name: '商品A', salesCount: 5, salesAmount: 25_000 }),
      expect.objectContaining({ id: '22', name: '商品B', salesCount: 3, salesAmount: 18_000 }),
    ]);
    expect(prisma.orderItem.groupBy.mock.calls[0][0].where.order.status.in).toContain(OrderStatus.paid);
  });

  it('returns recent order fields consumed by the admin dashboard and bounds list size', async () => {
    const createdAt = new Date('2026-08-09T12:00:00.000Z');
    prisma.order.findMany.mockResolvedValue([
      {
        id: 31n,
        orderNo: 'DASHBOARD001',
        userId: 41n,
        status: OrderStatus.completed,
        totalAmount: 9_900,
        payAmount: 9_900,
        createdAt,
        user: { id: 41n, nickname: '测试用户', phone: '13800138000' },
        orderItems: [
          {
            id: 51n,
            orderId: 31n,
            productId: 61n,
            skuId: 71n,
            activityId: null,
            supplierId: null,
            productName: '测试商品',
            quantity: 1,
            price: 9_900,
            subtotal: 9_900,
          },
        ],
      },
    ]);

    const result = await service.getRecentOrders(10);

    expect(result[0]).toEqual(expect.objectContaining({
      id: '31',
      userName: '测试用户',
      createTime: createdAt,
      createdAt,
    }));
    await expect(service.getRecentOrders(101)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.order.findMany).toHaveBeenCalledTimes(1);
  });
});
