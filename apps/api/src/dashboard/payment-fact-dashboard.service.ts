import { BadRequestException, Injectable } from '@nestjs/common';
import { PAYMENT_STATUS } from '../common/constants/payment';
import { PrismaService } from '../common/prisma/prisma.service';
import { DashboardService } from './dashboard.service';

interface TrendRange {
  date: Date;
  nextDate: Date;
  label: string;
}

const MAX_TREND_DAYS = 31;
const MAX_LIST_LIMIT = 100;

@Injectable()
export class PaymentFactDashboardService extends DashboardService {
  constructor(private readonly paymentPrisma: PrismaService) {
    super(paymentPrisma);
  }

  override async getStats() {
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
      this.paymentPrisma.orderPayment.aggregate({
        _sum: { amount: true },
        _count: true,
        where: { status: PAYMENT_STATUS.SUCCESS, paidAt: { gte: today } },
      }),
      this.paymentPrisma.orderPayment.aggregate({
        _sum: { amount: true },
        _count: true,
        where: {
          status: PAYMENT_STATUS.SUCCESS,
          paidAt: { gte: yesterday, lt: today },
        },
      }),
      this.paymentPrisma.orderPayment.aggregate({
        _sum: { amount: true },
        _count: true,
        where: { status: PAYMENT_STATUS.SUCCESS, paidAt: { gte: monthStart } },
      }),
      this.paymentPrisma.user.count({ where: { createdAt: { gte: today }, deletedAt: null } }),
      this.paymentPrisma.user.count({
        where: { createdAt: { gte: yesterday, lt: today }, deletedAt: null },
      }),
      this.paymentPrisma.user.count({ where: { createdAt: { gte: monthStart }, deletedAt: null } }),
      this.paymentPrisma.user.count({ where: { deletedAt: null } }),
      this.paymentPrisma.order.count(),
      this.paymentPrisma.product.count({ where: { deletedAt: null } }),
      this.paymentPrisma.product.count({ where: { deletedAt: null, status: 1 } }),
      this.paymentPrisma.order.count({ where: { status: 'pending_payment' } }),
      this.paymentPrisma.order.count({
        where: { status: { in: ['pending_delivery', 'pending_pickup'] } },
      }),
      this.paymentPrisma.aftersaleOrder.count({ where: { status: 'pending_review' } }),
    ]);

    const todaySalesAmount = todaySales._sum.amount || 0;
    const yesterdaySalesAmount = yesterdaySales._sum.amount || 0;
    const monthSalesAmount = monthSales._sum.amount || 0;
    const todayOrderCount = todaySales._count;
    const yesterdayOrderCount = yesterdaySales._count;
    const monthOrderCount = monthSales._count;
    const salesGrowth = this.growth(todaySalesAmount, yesterdaySalesAmount);
    const orderGrowth = this.growth(todayOrderCount, yesterdayOrderCount);
    const userGrowth = this.growth(todayUsers, yesterdayUsers);

    return {
      today: {
        salesAmount: todaySalesAmount,
        orderCount: todayOrderCount,
        userCount: todayUsers,
        avgPrice: todayOrderCount > 0 ? Math.round(todaySalesAmount / todayOrderCount) : 0,
      },
      yesterday: {
        salesAmount: yesterdaySalesAmount,
        orderCount: yesterdayOrderCount,
        userCount: yesterdayUsers,
        avgPrice: yesterdayOrderCount > 0 ? Math.round(yesterdaySalesAmount / yesterdayOrderCount) : 0,
      },
      month: {
        salesAmount: monthSalesAmount,
        orderCount: monthOrderCount,
        userCount: monthUsers,
      },
      growth: { salesGrowth, orderGrowth, userGrowth },
      overview: {
        totalUsers,
        totalOrders,
        totalProducts,
        onSaleProducts,
        pendingPaymentOrders,
        pendingDeliveryOrders,
        pendingReviewAftersale,
      },
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

  override async getSalesChart(days: number = 7) {
    this.assertDays(days);
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - (days - 1));
    return this.getTrend(this.buildRanges(start, end));
  }

  override async getSalesChartByDateRange(startDate: string, endDate: string) {
    const start = this.parseDate(startDate);
    const end = this.parseDate(endDate);
    if (end < start) {
      throw new BadRequestException('endDate must not be earlier than startDate');
    }
    const ranges = this.buildRanges(start, end);
    this.assertDays(ranges.length);
    return this.getTrend(ranges);
  }

  override async getTopProducts(limit: number = 10) {
    const safeLimit = this.limit(limit);
    const sales = await this.paymentPrisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        order: { is: { payment: { is: { status: PAYMENT_STATUS.SUCCESS } } } },
        product: { is: { deletedAt: null, status: 1 } },
      },
      _sum: { quantity: true, subtotal: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: safeLimit,
    });
    if (!sales.length) return [];

    const products = await this.paymentPrisma.product.findMany({
      where: { id: { in: sales.map((row) => row.productId) }, deletedAt: null, status: 1 },
      select: { id: true, name: true, mainImage: true, totalSales: true, minPrice: true },
    });
    const productMap = new Map(products.map((product) => [product.id.toString(), product]));

    return sales.flatMap((row) => {
      const product = productMap.get(row.productId.toString());
      return product
        ? [{
            ...product,
            id: product.id.toString(),
            salesCount: row._sum.quantity || 0,
            salesAmount: row._sum.subtotal || 0,
          }]
        : [];
    });
  }

  private async getTrend(ranges: TrendRange[]) {
    const result = [];
    for (const range of ranges) {
      const metrics = await this.paymentPrisma.orderPayment.aggregate({
        _sum: { amount: true },
        _count: true,
        where: {
          status: PAYMENT_STATUS.SUCCESS,
          paidAt: { gte: range.date, lt: range.nextDate },
        },
      });
      const salesAmount = metrics._sum.amount || 0;
      result.push({
        date: range.label,
        orderCount: metrics._count,
        salesAmount,
        revenue: salesAmount,
      });
    }
    return result;
  }

  private buildRanges(start: Date, end: Date): TrendRange[] {
    const ranges: TrendRange[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      const date = new Date(cursor);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      ranges.push({ date, nextDate, label: this.dateKey(date) });
      cursor.setDate(cursor.getDate() + 1);
    }
    return ranges;
  }

  private parseDate(value: string) {
    const match = /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})$/.exec(value);
    if (!match?.groups) throw new BadRequestException('Invalid date range');
    const date = new Date(
      Number(match.groups.year),
      Number(match.groups.month) - 1,
      Number(match.groups.day),
    );
    date.setHours(0, 0, 0, 0);
    if (this.dateKey(date) !== value) throw new BadRequestException('Invalid date range');
    return date;
  }

  private dateKey(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private assertDays(days: number) {
    if (!Number.isInteger(days) || days < 1 || days > MAX_TREND_DAYS) {
      throw new BadRequestException(`sales chart range must be between 1 and ${MAX_TREND_DAYS} days`);
    }
  }

  private limit(limit: number) {
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIST_LIMIT) {
      throw new BadRequestException(`limit must be between 1 and ${MAX_LIST_LIMIT}`);
    }
    return limit;
  }

  private growth(current: number, previous: number) {
    if (previous > 0) return Math.round(((current - previous) / previous) * 10000) / 100;
    return current > 0 ? 100 : 0;
  }
}
