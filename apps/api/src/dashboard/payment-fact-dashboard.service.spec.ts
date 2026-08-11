import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PAYMENT_STATUS } from '../common/constants/payment';
import { PrismaService } from '../common/prisma/prisma.service';
import { DashboardModule } from './dashboard.module';
import { DashboardService } from './dashboard.service';
import { PaymentFactDashboardService } from './payment-fact-dashboard.service';

function createMockPrisma() {
  return {
    orderPayment: {
      aggregate: jest.fn() as any,
    },
    order: {
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

describe('PaymentFactDashboardService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let service: PaymentFactDashboardService;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new PaymentFactDashboardService(prisma as any);
  });

  it('derives overview sales and order counts from successful payment facts', async () => {
    prisma.orderPayment.aggregate
      .mockResolvedValueOnce({ _sum: { amount: 10_000 }, _count: 2 })
      .mockResolvedValueOnce({ _sum: { amount: 5_000 }, _count: 1 })
      .mockResolvedValueOnce({ _sum: { amount: 50_000 }, _count: 10 });
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
    expect(prisma.orderPayment.aggregate).toHaveBeenCalledTimes(3);
    expect(prisma.orderPayment.aggregate.mock.calls[0][0].where.status).toBe(PAYMENT_STATUS.SUCCESS);
    expect(prisma.orderPayment.aggregate.mock.calls[0][0].where.paidAt).toBeDefined();
  });

  it('keeps aftersale order state out of sales trend accounting', async () => {
    prisma.orderPayment.aggregate
      .mockResolvedValueOnce({ _sum: { amount: 12_000 }, _count: 3 })
      .mockResolvedValueOnce({ _sum: { amount: 8_000 }, _count: 2 });

    const result = await service.getSalesChartByDateRange('2026-08-08', '2026-08-09');

    expect(result).toEqual([
      expect.objectContaining({ date: '2026-08-08', orderCount: 3, salesAmount: 12_000 }),
      expect.objectContaining({ date: '2026-08-09', orderCount: 2, salesAmount: 8_000 }),
    ]);
    expect(prisma.orderPayment.aggregate).toHaveBeenCalledTimes(2);
    expect(prisma.orderPayment.aggregate.mock.calls[0][0].where.status).toBe(PAYMENT_STATUS.SUCCESS);
  });

  it('rejects oversized trend ranges before querying the database', async () => {
    await expect(
      service.getSalesChartByDateRange('2026-07-01', '2026-08-01'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.orderPayment.aggregate).not.toHaveBeenCalled();
  });

  it('builds hot-product metrics only from orders with a successful payment record', async () => {
    prisma.orderItem.groupBy.mockResolvedValue([
      { productId: 11n, _sum: { quantity: 5, subtotal: 25_000 } },
    ]);
    prisma.product.findMany.mockResolvedValue([
      { id: 11n, name: '商品A', mainImage: null, totalSales: 5, minPrice: 5_000 },
    ]);

    const result = await service.getTopProducts(10);

    expect(result[0]).toEqual(expect.objectContaining({
      id: '11',
      salesCount: 5,
      salesAmount: 25_000,
    }));
    expect(
      prisma.orderItem.groupBy.mock.calls[0][0].where.order.is.payment.is.status,
    ).toBe(PAYMENT_STATUS.SUCCESS);
  });

  it('is the actual DashboardService provider exposed by DashboardModule', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [DashboardModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    expect(moduleRef.get(DashboardService)).toBeInstanceOf(PaymentFactDashboardService);
    await moduleRef.close();
  });
});
