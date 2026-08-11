import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { OrderStatus } from '@prisma/client';

interface SalesChartDateRange {
  date: Date;
  nextDate: Date;
  label: string;
}

const PAID_SALES_STATUSES: OrderStatus[] = [
  OrderStatus.paid,
  OrderStatus.pending_delivery,
  OrderStatus.pending_pickup,
  OrderStatus.delivered,
  OrderStatus.completed,
];
const MAX_TREND_DAYS = 31;
const MAX_LIST_LIMIT = 100;

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [
      todaySales,
      yesterdaySales,
      monthSales,
      todayUsers,
      yesterdayUsers,
      monthUsers,
      totalUsers,
      totalOrders,
      totalProducts,
      onSaleProducts,
      pendingPaymentOrders,
      pendingDeliveryOrders,
      pendingReviewAftersale,
    ] = await Promise.all([
      this.prisma.order.aggregate({
        _sum: { payAmount: true },
        _count: true,
        where: { status: { in: PAID_SALES_STATUSES }, paidAt: { gte: today } },
      }),
      this.prisma.order.aggregate({
        _sum: { payAmount: true },
        _count: true,
        where: {
          status: { in: PAID_SALES_STATUSES },
          paidAt: { gte: yesterday, lt: today },
        },
      }),
      this.prisma.order.aggregate({
        _sum: { payAmount: true },
        _count: true,
        where: { status: { in: PAID_SALES_STATUSES }, paidAt: { gte: monthStart } },
      }),
      this.prisma.user.count({ where: { createdAt: { gte: today }, deletedAt: null } }),
      this.prisma.user.count({
        where: { createdAt: { gte: yesterday, lt: today }, deletedAt: null },
      }),
      this.prisma.user.count({ where: { createdAt: { gte: monthStart }, deletedAt: null } }),
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.order.count(),
      this.prisma.product.count({ where: { deletedAt: null } }),
      this.prisma.product.count({ where: { deletedAt: null, status: 1 } }),
      this.prisma.order.count({ where: { status: OrderStatus.pending_payment } }),
      this.prisma.order.count({
        where: { status: { in: [OrderStatus.pending_delivery, OrderStatus.pending_pickup] } },
      }),
      this.prisma.aftersaleOrder.count({ where: { status: 'pending_review' } }),
    ]);

    const todaySalesAmount = todaySales._sum.payAmount || 0;
    const yesterdaySalesAmount = yesterdaySales._sum.payAmount || 0;
    const monthSalesAmount = monthSales._sum.payAmount || 0;

    const todayOrderCount = todaySales._count;
    const yesterdayOrderCount = yesterdaySales._count;
    const monthOrderCount = monthSales._count;

    const todayAvgPrice = todayOrderCount > 0 ? Math.round(todaySalesAmount / todayOrderCount) : 0;
    const yesterdayAvgPrice = yesterdayOrderCount > 0
      ? Math.round(yesterdaySalesAmount / yesterdayOrderCount)
      : 0;

    const salesGrowth = this.calculateGrowth(todaySalesAmount, yesterdaySalesAmount);
    const orderGrowth = this.calculateGrowth(todayOrderCount, yesterdayOrderCount);
    const userGrowth = this.calculateGrowth(todayUsers, yesterdayUsers);

    return {
      today: {
        salesAmount: todaySalesAmount,
        orderCount: todayOrderCount,
        userCount: todayUsers,
        avgPrice: todayAvgPrice,
      },
      yesterday: {
        salesAmount: yesterdaySalesAmount,
        orderCount: yesterdayOrderCount,
        userCount: yesterdayUsers,
        avgPrice: yesterdayAvgPrice,
      },
      month: {
        salesAmount: monthSalesAmount,
        orderCount: monthOrderCount,
        userCount: monthUsers,
      },
      growth: {
        salesGrowth,
        orderGrowth,
        userGrowth,
      },
      overview: {
        totalUsers,
        totalOrders,
        totalProducts,
        onSaleProducts,
        pendingPaymentOrders,
        pendingDeliveryOrders,
        pendingReviewAftersale,
      },
      // Admin dashboard has historically consumed a flat shape. Keep the nested
      // structure above for compatibility while also exposing the actual UI contract.
      todaySales: todaySalesAmount,
      todayOrders: todayOrderCount,
      todayUsers,
      totalProducts,
      onSaleProducts,
      salesGrowth,
      orderGrowth,
      userGrowth,
    };
  }

  async getSalesChart(days: number = 7) {
    this.assertTrendDays(days);
    return this.getSalesChartForRanges(this.buildRecentDateRanges(days));
  }

  async getSalesChartByDateRange(startDate: string, endDate: string) {
    const start = this.parseChartDate(startDate);
    const end = this.parseChartDate(endDate);

    if (end < start) {
      throw new BadRequestException('endDate must not be earlier than startDate');
    }

    const ranges = this.buildDateRanges(start, end);
    this.assertTrendDays(ranges.length);
    return this.getSalesChartForRanges(ranges);
  }

  private buildRecentDateRanges(days: number): SalesChartDateRange[] {
    const ranges: SalesChartDateRange[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      ranges.push({
        date,
        nextDate,
        label: this.formatDateKey(date),
      });
    }
    return ranges;
  }

  private buildDateRanges(start: Date, end: Date): SalesChartDateRange[] {
    const ranges: SalesChartDateRange[] = [];
    const current = new Date(start);

    while (current <= end) {
      const date = new Date(current);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      ranges.push({
        date,
        nextDate,
        label: this.formatDateKey(date),
      });

      current.setDate(current.getDate() + 1);
    }

    return ranges;
  }

  private parseChartDate(value: string): Date {
    const dateOnly = /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})$/.exec(value);
    if (dateOnly?.groups) {
      const date = new Date(
        Number(dateOnly.groups.year),
        Number(dateOnly.groups.month) - 1,
        Number(dateOnly.groups.day),
      );
      date.setHours(0, 0, 0, 0);
      if (this.formatDateKey(date) !== value) {
        throw new BadRequestException('Invalid date range');
      }
      return date;
    }

    throw new BadRequestException('Invalid date range');
  }

  private formatDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private assertTrendDays(days: number) {
    if (!Number.isInteger(days) || days < 1 || days > MAX_TREND_DAYS) {
      throw new BadRequestException(`sales chart range must be between 1 and ${MAX_TREND_DAYS} days`);
    }
  }

  private normalizeLimit(limit: number) {
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIST_LIMIT) {
      throw new BadRequestException(`limit must be between 1 and ${MAX_LIST_LIMIT}`);
    }
    return limit;
  }

  private calculateGrowth(current: number, previous: number) {
    if (previous > 0) {
      return Math.round(((current - previous) / previous) * 10000) / 100;
    }
    return current > 0 ? 100 : 0;
  }

  private async getSalesChartForRanges(ranges: SalesChartDateRange[]) {
    const result = [];

    for (const range of ranges) {
      const metrics = await this.prisma.order.aggregate({
        _sum: { payAmount: true },
        _count: true,
        where: {
          status: { in: PAID_SALES_STATUSES },
          paidAt: { gte: range.date, lt: range.nextDate },
        },
      });
      const salesAmount = metrics._sum.payAmount || 0;

      result.push({
        date: range.label,
        orderCount: metrics._count,
        revenue: salesAmount,
        salesAmount,
      });
    }
    return result;
  }

  async getTopProducts(limit: number = 10) {
    const safeLimit = this.normalizeLimit(limit);
    const sales = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        order: { status: { in: PAID_SALES_STATUSES } },
        product: { deletedAt: null, status: 1 },
      },
      _sum: { quantity: true, subtotal: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: safeLimit,
    });

    if (!sales.length) return [];
    const products = await this.prisma.product.findMany({
      where: { id: { in: sales.map((row) => row.productId) }, deletedAt: null, status: 1 },
      select: {
        id: true,
        name: true,
        mainImage: true,
        totalSales: true,
        minPrice: true,
      },
    });
    const productMap = new Map(products.map((product) => [product.id.toString(), product]));

    return sales.flatMap((row) => {
      const product = productMap.get(row.productId.toString());
      if (!product) return [];
      return [{
        ...product,
        id: product.id.toString(),
        salesCount: row._sum.quantity || 0,
        salesAmount: row._sum.subtotal || 0,
      }];
    });
  }

  async getRecentOrders(limit: number = 10) {
    const safeLimit = this.normalizeLimit(limit);
    const orders = await this.prisma.order.findMany({
      take: safeLimit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, nickname: true, phone: true } },
        orderItems: {
          select: {
            id: true,
            orderId: true,
            productId: true,
            skuId: true,
            activityId: true,
            supplierId: true,
            productName: true,
            quantity: true,
            price: true,
            subtotal: true,
          },
        },
      },
    });

    return orders.map((order) => ({
      id: order.id.toString(),
      orderNo: order.orderNo,
      userId: order.userId.toString(),
      status: order.status,
      totalAmount: order.totalAmount,
      payAmount: order.payAmount,
      createdAt: order.createdAt,
      createTime: order.createdAt,
      userName: order.user?.nickname || order.user?.phone || `用户${order.userId.toString()}`,
      user: order.user ? { ...order.user, id: order.user.id.toString() } : null,
      items: order.orderItems.map((item) => ({
        ...item,
        id: item.id.toString(),
        orderId: item.orderId.toString(),
        productId: item.productId.toString(),
        skuId: item.skuId.toString(),
        activityId: item.activityId?.toString(),
        supplierId: item.supplierId?.toString(),
      })),
    }));
  }
}
