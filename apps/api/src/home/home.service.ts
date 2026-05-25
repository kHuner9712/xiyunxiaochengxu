import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { calculateBabyMonthAge, getMemberLevelByGrowth, MEMBER_LEVELS, paginate, serializeProductCard } from '@baby-mall/shared';

@Injectable()
export class HomeService {
  private readonly logger = new Logger(HomeService.name);

  constructor(private prisma: PrismaService) {}

  async getHomeData(userId?: string) {
    const [banners, recommendations, hotProducts, newProducts, activities, monthAgeRecommend] = await Promise.all([
      this.getBanners(),
      this.getRecommendations(),
      this.getHotProducts(),
      this.getNewProducts(),
      this.getActivities(),
      userId ? this.getMonthAgeRecommend(userId) : [],
    ]);

    return {
      banners,
      quickEntries: [],
      monthRecommend: monthAgeRecommend,
      hotProducts,
      newProducts,
      activities,
    };
  }

  async getGuessProducts(page: number = 1, pageSize: number = 10) {
    const where = {
      deletedAt: null,
      status: 1,
    };

    const [list, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy: { totalSales: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          name: true,
          mainImage: true,
          minPrice: true,
          totalSales: true,
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return paginate(
      list.map((p) => serializeProductCard(p)),
      total,
      page,
      pageSize,
    );
  }

  private async getBanners() {
    return this.prisma.banner.findMany({
      where: { status: 1 },
      orderBy: { sortOrder: 'asc' },
      take: 10,
    });
  }

  private async getRecommendations() {
    const list = await this.prisma.product.findMany({
      where: {
        deletedAt: null,
        status: 1,
        isRecommend: 1,
      },
      orderBy: { sortOrder: 'asc' },
      take: 10,
      select: {
        id: true,
        name: true,
        mainImage: true,
        minPrice: true,
        totalSales: true,
        isRecommend: true,
      },
    });
    return list.map((p) => serializeProductCard(p));
  }

  private async getHotProducts() {
    const list = await this.prisma.product.findMany({
      where: {
        deletedAt: null,
        status: 1,
      },
      orderBy: { totalSales: 'desc' },
      take: 10,
      select: {
        id: true,
        name: true,
        mainImage: true,
        minPrice: true,
        totalSales: true,
      },
    });
    return list.map((p) => serializeProductCard(p));
  }

  private async getNewProducts() {
    const list = await this.prisma.product.findMany({
      where: {
        deletedAt: null,
        status: 1,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        name: true,
        mainImage: true,
        minPrice: true,
        totalSales: true,
      },
    });
    return list.map((p) => serializeProductCard({ ...p, tag: '新品' }));
  }

  private async getActivities() {
    const now = new Date();
    const list = await this.prisma.activity.findMany({
      where: {
        status: 2,
        startTime: { lte: now },
        endTime: { gte: now },
      },
      orderBy: { sortOrder: 'asc' },
      take: 5,
      select: {
        id: true,
        name: true,
        type: true,
        bannerImage: true,
        startTime: true,
        endTime: true,
      },
    });
    return list.map((a) => ({ ...a, id: a.id.toString(), image: a.bannerImage }));
  }

  private async getMonthAgeRecommend(userId: string) {
    const defaultProfile = await this.prisma.babyProfile.findFirst({
      where: { userId: BigInt(userId), deletedAt: null, isDefault: 1 },
    });

    if (!defaultProfile) return [];

    const monthAge = calculateBabyMonthAge(defaultProfile.birthday);

    const minMonth = Math.max(0, monthAge - 1);
    const maxMonth = monthAge + 1;

    const list = await this.prisma.product.findMany({
      where: {
        deletedAt: null,
        status: 1,
        recommendAgeMin: { lte: maxMonth },
        recommendAgeMax: { gte: minMonth },
      },
      orderBy: { totalSales: 'desc' },
      take: 10,
      select: {
        id: true,
        name: true,
        mainImage: true,
        minPrice: true,
        totalSales: true,
        recommendAgeMin: true,
        recommendAgeMax: true,
      },
    });
    return list.map((p) => serializeProductCard({ ...p, tag: `${monthAge}月龄` }));
  }
}
