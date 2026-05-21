import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { OrderStatus } from '@prisma/client';

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

    const paidStatuses = [OrderStatus.paid, OrderStatus.pending_delivery, OrderStatus.delivered, OrderStatus.completed];

    const [
      todaySales,
      yesterdaySales,
      monthSales,
      todayOrders,
      yesterdayOrders,
      monthOrders,
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
      this.prisma.order.count({ where: { status: OrderStatus.pending_delivery } }),
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
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const paidStatuses = [OrderStatus.paid, OrderStatus.pending_delivery, OrderStatus.delivered, OrderStatus.completed];

      const [orderCount, revenue] = await Promise.all([
        this.prisma.order.count({
          where: { createdAt: { gte: date, lt: nextDate } },
        }),
        this.prisma.order.aggregate({
          _sum: { payAmount: true },
          where: {
            status: { in: paidStatuses },
            paidAt: { gte: date, lt: nextDate },
          },
        }),
      ]);

      result.push({
        date: date.toISOString().split('T')[0],
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
        orderItems: { select: { productName: true, quantity: true, price: true } },
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
      items: o.orderItems,
    }));
  }
}
