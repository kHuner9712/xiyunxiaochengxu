import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { calculateBabyMonthAge, getMemberLevelByGrowth, MEMBER_LEVELS, paginate } from '@baby-mall/shared';

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
      recommendations,
      hotProducts,
      newProducts,
      activities,
      monthAgeRecommend,
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
      list.map((p) => ({ ...p, id: p.id.toString() })),
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
    return this.prisma.product.findMany({
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
    }).then((list) => list.map((p) => ({ ...p, id: p.id.toString() })));
  }

  private async getHotProducts() {
    return this.prisma.product.findMany({
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
    }).then((list) => list.map((p) => ({ ...p, id: p.id.toString() })));
  }

  private async getNewProducts() {
    return this.prisma.product.findMany({
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
    }).then((list) => list.map((p) => ({ ...p, id: p.id.toString() })));
  }

  private async getActivities() {
    const now = new Date();
    return this.prisma.activity.findMany({
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
    }).then((list) => list.map((a) => ({ ...a, id: a.id.toString() })));
  }

  private async getMonthAgeRecommend(userId: string) {
    const defaultProfile = await this.prisma.babyProfile.findFirst({
      where: { userId: BigInt(userId), deletedAt: null, isDefault: 1 },
    });

    if (!defaultProfile) return [];

    const monthAge = calculateBabyMonthAge(defaultProfile.birthday);

    const minMonth = Math.max(0, monthAge - 1);
    const maxMonth = monthAge + 1;

    return this.prisma.product.findMany({
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
    }).then((list) => list.map((p) => ({ ...p, id: p.id.toString(), monthAge })));
  }
}
