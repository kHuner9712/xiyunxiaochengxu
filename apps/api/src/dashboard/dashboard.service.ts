import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { OrderStatus } from '@prisma/client';

interface SalesChartDateRange {
  date: Date;
  nextDate: Date;
  label: string;
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private prisma: PrismaService) {}

  async getStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const paidStatuses = [OrderStatus.pending_delivery, OrderStatus.pending_pickup, OrderStatus.delivered, OrderStatus.completed];

    const [
      todaySales,
      yesterdaySales,
      monthSales,
      todayOrders,
      yesterdayOrders,
      _monthOrders,
      todayUsers,
      monthUsers,
      totalUsers,
      totalOrders,
      totalProducts,
      pendingPaymentOrders,
      pendingDeliveryOrders,
      pendingReviewAftersale,
    ] = await Promise.all([
      this.prisma.order.aggregate({
        _sum: { payAmount: true },
        _count: true,
        where: { status: { in: paidStatuses }, paidAt: { gte: today } },
      }),
      this.prisma.order.aggregate({
        _sum: { payAmount: true },
        _count: true,
        where: { status: { in: paidStatuses }, paidAt: { gte: yesterday, lt: today } },
      }),
      this.prisma.order.aggregate({
        _sum: { payAmount: true },
        _count: true,
        where: { status: { in: paidStatuses }, paidAt: { gte: monthStart } },
      }),
      this.prisma.order.count({ where: { createdAt: { gte: today } } }),
      this.prisma.order.count({ where: { createdAt: { gte: yesterday, lt: today } } }),
      this.prisma.order.count({ where: { createdAt: { gte: monthStart } } }),
      this.prisma.user.count({ where: { createdAt: { gte: today }, deletedAt: null } }),
      this.prisma.user.count({ where: { createdAt: { gte: monthStart }, deletedAt: null } }),
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.order.count(),
      this.prisma.product.count({ where: { deletedAt: null } }),
      this.prisma.order.count({ where: { status: OrderStatus.pending_payment } }),
      this.prisma.order.count({ where: { status: { in: [OrderStatus.pending_delivery, OrderStatus.pending_pickup] } } }),
      this.prisma.aftersaleOrder.count({ where: { status: 'pending_review' } }),
    ]);

    const todaySalesAmount = todaySales._sum.payAmount || 0;
    const yesterdaySalesAmount = yesterdaySales._sum.payAmount || 0;
    const monthSalesAmount = monthSales._sum.payAmount || 0;

    const todayOrderCount = todaySales._count;
    const yesterdayOrderCount = yesterdaySales._count;
    const monthOrderCount = monthSales._count;

    const todayAvgPrice = todayOrderCount > 0 ? Math.round(todaySalesAmount / todayOrderCount) : 0;
    const yesterdayAvgPrice = yesterdayOrderCount > 0 ? Math.round(yesterdaySalesAmount / yesterdayOrderCount) : 0;

    const salesGrowth = yesterdaySalesAmount > 0
      ? Math.round(((todaySalesAmount - yesterdaySalesAmount) / yesterdaySalesAmount) * 10000) / 100
      : todaySalesAmount > 0 ? 100 : 0;

    const orderGrowth = yesterdayOrders > 0
      ? Math.round(((todayOrders - yesterdayOrders) / yesterdayOrders) * 10000) / 100
      : todayOrders > 0 ? 100 : 0;

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
      },
      overview: {
        totalUsers,
        totalOrders,
        totalProducts,
        pendingPaymentOrders,
        pendingDeliveryOrders,
        pendingReviewAftersale,
      },
    };
  }

  async getSalesChart(days: number = 7) {
    return this.getSalesChartForRanges(this.buildRecentDateRanges(days));
  }

  async getSalesChartByDateRange(startDate: string, endDate: string) {
    const start = this.parseChartDate(startDate);
    const end = this.parseChartDate(endDate);

    if (end < start) {
      throw new BadRequestException('endDate must not be earlier than startDate');
    }

    return this.getSalesChartForRanges(this.buildDateRanges(start, end));
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

  private async getSalesChartForRanges(ranges: SalesChartDateRange[]) {
    const result = [];
    const paidStatuses = [OrderStatus.pending_delivery, OrderStatus.pending_pickup, OrderStatus.delivered, OrderStatus.completed];

    for (const range of ranges) {
      const [orderCount, revenue] = await Promise.all([
        this.prisma.order.count({
          where: { createdAt: { gte: range.date, lt: range.nextDate } },
        }),
        this.prisma.order.aggregate({
          _sum: { payAmount: true },
          where: {
            status: { in: paidStatuses },
            paidAt: { gte: range.date, lt: range.nextDate },
          },
        }),
      ]);

      result.push({
        date: range.label,
        orderCount,
        revenue: revenue._sum.payAmount || 0,
      });
    }
    return result;
  }

  async getTopProducts(limit: number = 10) {
    const products = await this.prisma.product.findMany({
      where: { deletedAt: null, status: 1 },
      orderBy: { totalSales: 'desc' },
      take: limit,
      select: { id: true, name: true, mainImage: true, totalSales: true, minPrice: true },
    });

    return products.map((p) => ({
      ...p,
      id: p.id.toString(),
    }));
  }

  async getRecentOrders(limit: number = 10) {
    const orders = await this.prisma.order.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, nickname: true, phone: true } },
        orderItems: { select: { id: true, orderId: true, productId: true, skuId: true, activityId: true, supplierId: true, productName: true, quantity: true, price: true } },
      },
    });

    return orders.map((o) => ({
      id: o.id.toString(),
      orderNo: o.orderNo,
      userId: o.userId.toString(),
      status: o.status,
      totalAmount: o.totalAmount,
      payAmount: o.payAmount,
      createdAt: o.createdAt,
      user: o.user ? { ...o.user, id: o.user.id.toString() } : null,
      items: o.orderItems.map((i) => ({
        ...i,
        id: i.id.toString(),
        orderId: i.orderId.toString(),
        productId: i.productId.toString(),
        skuId: i.skuId.toString(),
        activityId: i.activityId?.toString(),
        supplierId: i.supplierId?.toString(),
      })),
    }));
  }
}
