import { BadRequestException, Injectable } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { StatisticsQueryDto } from './dto/statistics-query.dto';

interface DateRange {
  start: Date;
  end: Date;
}

@Injectable()
export class StatisticsService {
  constructor(private prisma: PrismaService) {}

  async getOverview(dto: StatisticsQueryDto) {
    const range = this.resolveRange(dto);
    const paidStatuses = [OrderStatus.pending_delivery, OrderStatus.pending_pickup, OrderStatus.delivered, OrderStatus.completed];
    const orderWhere = { createdAt: { gte: range.start, lt: range.end } };
    const paidOrderWhere = { status: { in: paidStatuses }, paidAt: { gte: range.start, lt: range.end } };

    const [salesAggregate, totalOrders, totalUsers, salesList, categoryList, userGrowthList, productRankList] = await Promise.all([
      this.prisma.order.aggregate({
        _sum: { payAmount: true },
        _count: true,
        where: paidOrderWhere,
      }),
      this.prisma.order.count({ where: orderWhere }),
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.getSalesList(range, paidStatuses),
      this.getCategoryList(range, paidStatuses),
      this.getUserGrowthList(range),
      this.getProductRankList(range, paidStatuses),
    ]);

    const totalSales = salesAggregate._sum.payAmount || 0;
    const paidOrderCount = salesAggregate._count || 0;

    return {
      totalSales,
      totalOrders,
      totalUsers,
      avgOrderAmount: paidOrderCount > 0 ? Math.round(totalSales / paidOrderCount) : 0,
      salesList,
      categoryList,
      userGrowthList,
      productRankList,
    };
  }

  async exportOverview(dto: StatisticsQueryDto) {
    const overview = await this.getOverview(dto);
    const rows = [
      ['指标', '值'],
      ['总销售额(分)', String(overview.totalSales)],
      ['总订单数', String(overview.totalOrders)],
      ['总用户数', String(overview.totalUsers)],
      ['平均客单价(分)', String(overview.avgOrderAmount)],
    ];
    return rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  }

  private async getSalesList(range: DateRange, paidStatuses: OrderStatus[]) {
    const ranges = this.buildDateRanges(range.start, range.end);
    const result = [];

    for (const item of ranges) {
      const [sales, orderCount] = await Promise.all([
        this.prisma.order.aggregate({
          _sum: { payAmount: true },
          where: {
            status: { in: paidStatuses },
            paidAt: { gte: item.start, lt: item.end },
          },
        }),
        this.prisma.order.count({
          where: {
            status: { in: paidStatuses },
            paidAt: { gte: item.start, lt: item.end },
          },
        }),
      ]);

      const salesAmount = sales._sum.payAmount || 0;
      result.push({
        date: this.formatDateKey(item.start),
        salesAmount,
        orderCount,
        avgAmount: orderCount > 0 ? Math.round(salesAmount / orderCount) : 0,
      });
    }

    return result;
  }

  private async getCategoryList(range: DateRange, paidStatuses: OrderStatus[]) {
    const items = await this.prisma.orderItem.findMany({
      where: {
        order: {
          status: { in: paidStatuses },
          paidAt: { gte: range.start, lt: range.end },
        },
      },
      include: {
        product: { include: { category: { select: { name: true } } } },
      },
    });

    const categoryMap = new Map<string, { categoryName: string; salesAmount: number; orderCount: number }>();
    for (const item of items) {
      const categoryName = item.product?.category?.name || '未分类';
      const current = categoryMap.get(categoryName) || { categoryName, salesAmount: 0, orderCount: 0 };
      current.salesAmount += item.subtotal || item.price * item.quantity;
      current.orderCount += 1;
      categoryMap.set(categoryName, current);
    }

    const totalSales = Array.from(categoryMap.values()).reduce((sum, item) => sum + item.salesAmount, 0);
    return Array.from(categoryMap.values())
      .sort((a, b) => b.salesAmount - a.salesAmount)
      .map((item) => ({
        ...item,
        ratio: totalSales > 0 ? Math.round((item.salesAmount / totalSales) * 10000) / 100 : 0,
      }));
  }

  private async getUserGrowthList(range: DateRange) {
    const ranges = this.buildDateRanges(range.start, range.end);
    const result = [];

    for (const item of ranges) {
      const [newUsers, totalUsers] = await Promise.all([
        this.prisma.user.count({
          where: { deletedAt: null, createdAt: { gte: item.start, lt: item.end } },
        }),
        this.prisma.user.count({
          where: { deletedAt: null, createdAt: { lt: item.end } },
        }),
      ]);

      result.push({
        date: this.formatDateKey(item.start),
        newUsers,
        activeUsers: 0,
        totalUsers,
      });
    }

    return result;
  }

  private async getProductRankList(range: DateRange, paidStatuses: OrderStatus[]) {
    const items = await this.prisma.orderItem.findMany({
      where: {
        order: {
          status: { in: paidStatuses },
          paidAt: { gte: range.start, lt: range.end },
        },
      },
      select: {
        productId: true,
        productName: true,
        quantity: true,
        subtotal: true,
        price: true,
      },
    });

    const productMap = new Map<string, { productName: string; salesCount: number; salesAmount: number }>();
    for (const item of items) {
      const key = item.productId.toString();
      const current = productMap.get(key) || { productName: item.productName, salesCount: 0, salesAmount: 0 };
      current.salesCount += item.quantity;
      current.salesAmount += item.subtotal || item.price * item.quantity;
      productMap.set(key, current);
    }

    return Array.from(productMap.values())
      .sort((a, b) => b.salesAmount - a.salesAmount)
      .slice(0, 10);
  }

  private resolveRange(dto: StatisticsQueryDto): DateRange {
    if ((dto.startDate && !dto.endDate) || (!dto.startDate && dto.endDate)) {
      throw new BadRequestException('startDate and endDate must be provided together');
    }

    if (dto.startDate && dto.endDate) {
      const start = this.parseDate(dto.startDate);
      const end = this.parseDate(dto.endDate);
      if (end < start) {
        throw new BadRequestException('endDate must not be earlier than startDate');
      }
      end.setDate(end.getDate() + 1);
      return { start, end };
    }

    const end = new Date();
    end.setHours(0, 0, 0, 0);
    end.setDate(end.getDate() + 1);
    const start = new Date(end);
    start.setDate(start.getDate() - 7);
    return { start, end };
  }

  private buildDateRanges(start: Date, exclusiveEnd: Date) {
    const ranges: DateRange[] = [];
    const current = new Date(start);
    while (current < exclusiveEnd) {
      const next = new Date(current);
      next.setDate(next.getDate() + 1);
      ranges.push({ start: new Date(current), end: next });
      current.setDate(current.getDate() + 1);
    }
    return ranges;
  }

  private parseDate(value: string): Date {
    const match = /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})$/.exec(value);
    if (!match?.groups) {
      throw new BadRequestException('Invalid date range');
    }

    const date = new Date(Number(match.groups.year), Number(match.groups.month) - 1, Number(match.groups.day));
    date.setHours(0, 0, 0, 0);
    if (this.formatDateKey(date) !== value) {
      throw new BadRequestException('Invalid date range');
    }
    return date;
  }

  private formatDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
