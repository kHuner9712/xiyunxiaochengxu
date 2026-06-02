import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { calculateBabyMonthAge, paginate, serializeProductCard } from '@baby-mall/shared';
import { getAssetBaseUrl, normalizeAssetUrl } from '../common/utils/asset-url';

@Injectable()
export class HomeService {
  private readonly logger = new Logger(HomeService.name);
  private readonly assetBaseUrl = getAssetBaseUrl();

  constructor(private prisma: PrismaService) {}

  async getHomeData(userId?: string) {
    const [banners, _recommendations, hotProducts, newProducts, activities, monthAgeRecommend, homeDecor] = await Promise.all([
      this.getBanners(),
      this.getRecommendations(),
      this.getHotProducts(),
      this.getNewProducts(),
      this.getActivities(),
      userId ? this.getMonthAgeRecommend(userId) : [],
      this.getHomeDecorConfig(),
    ]);

    return {
      banners,
      quickEntries: homeDecor.quickEntries,
      announcement: homeDecor.announcement,
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
      list.map((p) => ({
        ...serializeProductCard(p),
        image: normalizeAssetUrl(p.mainImage, this.assetBaseUrl),
      })),
      total,
      page,
      pageSize,
    );
  }

  private async getBanners() {
    const list = await this.prisma.banner.findMany({
      where: { status: 1 },
      orderBy: { sortOrder: 'asc' },
      take: 10,
    });
    return list.map((b) => ({
      ...b,
      id: b.id.toString(),
      image: normalizeAssetUrl(b.image, this.assetBaseUrl),
    }));
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
    return list.map((p) => ({ ...serializeProductCard(p), image: normalizeAssetUrl(p.mainImage, this.assetBaseUrl) }));
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
    return list.map((p) => ({ ...serializeProductCard(p), image: normalizeAssetUrl(p.mainImage, this.assetBaseUrl) }));
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
    return list.map((p) => ({
      ...serializeProductCard({ ...p, tag: '新品' }),
      image: normalizeAssetUrl(p.mainImage, this.assetBaseUrl),
    }));
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
    return list.map((a) => ({
      ...a,
      id: a.id.toString(),
      image: normalizeAssetUrl(a.bannerImage, this.assetBaseUrl),
    }));
  }

  private async getHomeDecorConfig() {
    const config = await this.prisma.systemConfig.findFirst({
      where: { groupName: 'home_decor', configKey: 'config' },
    });
    const announcementSection = await this.prisma.homeSection.findFirst({
      where: { type: 'announcement', status: 1 },
      orderBy: { sortOrder: 'asc' },
    });

    const parsedConfig = this.parseJsonConfig(config?.configValue);
    const sectionConfig = this.parseJsonConfig(announcementSection?.config);
    const navIcons = Array.isArray(parsedConfig.navIcons) ? parsedConfig.navIcons : [];
    const quickEntries = navIcons
      .slice()
      .sort((a: any, b: any) => Number(a?.sort || 0) - Number(b?.sort || 0))
      .map((item: any, index: number) => ({
        id: String(index + 1),
        name: String(item?.name || ''),
        icon: normalizeAssetUrl(item?.icon, this.assetBaseUrl),
        linkType: Number(item?.linkType || 0),
        linkValue: String(item?.linkValue || item?.linkUrl || ''),
        linkUrl: String(item?.linkUrl || item?.linkValue || ''),
      }))
      .filter((item: any) => item.name && item.icon);

    return {
      quickEntries,
      announcement: String(
        parsedConfig.announcement ||
        sectionConfig.announcement ||
        (Array.isArray(sectionConfig.announcements) ? sectionConfig.announcements[0] : '') ||
        '',
      ),
    };
  }

  private parseJsonConfig(value: unknown): any {
    if (!value) return {};
    if (typeof value === 'object') return value;
    if (typeof value !== 'string') return {};
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
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
    return list.map((p) => ({
      ...serializeProductCard({ ...p, tag: `${monthAge}月龄` }),
      image: normalizeAssetUrl(p.mainImage, this.assetBaseUrl),
    }));
  }
}
