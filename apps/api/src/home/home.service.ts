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
    const [banners, recommendations, hotProducts, newProducts, activities, monthAgeRecommend, homeDecor] = await Promise.all([
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
      recommendations,
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
    const sections = await this.prisma.homeSection.findMany({
      where: { type: 'recommendation', status: 1 },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      take: 10,
    });
    const now = new Date();

    const resolved = await Promise.all(sections.map(async (section) => {
      const config = this.parseJsonConfig(section.config);
      const type = Number(config.recommendationType || 0);
      if (![1, 2, 3].includes(type)) return null;

      const storedItems = this.parseRecommendationItems(config.items);
      if (storedItems.length === 0) return null;
      const ids = storedItems.map((item) => item.id);
      const itemMap = new Map<string, any>();

      if (type === 1) {
        const products = await this.prisma.product.findMany({
          where: { id: { in: ids }, deletedAt: null, status: 1 },
          select: { id: true, name: true, mainImage: true, minPrice: true, totalSales: true },
        });
        for (const product of products) {
          itemMap.set(product.id.toString(), {
            ...serializeProductCard(product),
            id: product.id.toString(),
            image: normalizeAssetUrl(product.mainImage, this.assetBaseUrl),
          });
        }
      } else if (type === 2) {
        const activities = await this.prisma.activity.findMany({
          where: {
            id: { in: ids },
            status: 2,
            startTime: { lte: now },
            endTime: { gte: now },
          },
          select: { id: true, name: true, type: true, bannerImage: true, startTime: true, endTime: true },
        });
        for (const activity of activities) {
          itemMap.set(activity.id.toString(), {
            id: activity.id.toString(),
            name: activity.name,
            image: normalizeAssetUrl(activity.bannerImage, this.assetBaseUrl),
            type: Number(activity.type),
            startTime: activity.startTime,
            endTime: activity.endTime,
          });
        }
      } else {
        const contents = await this.prisma.content.findMany({
          where: { id: { in: ids }, deletedAt: null, status: 1 },
          select: { id: true, title: true, coverImage: true, summary: true, contentType: true, publishedAt: true },
        });
        for (const content of contents) {
          itemMap.set(content.id.toString(), {
            id: content.id.toString(),
            title: content.title,
            image: normalizeAssetUrl(content.coverImage, this.assetBaseUrl),
            summary: content.summary || '',
            contentType: content.contentType,
            publishedAt: content.publishedAt,
          });
        }
      }

      const items = storedItems
        .map((stored) => itemMap.get(stored.id.toString()))
        .filter(Boolean);
      if (items.length === 0) return null;

      return {
        id: section.id.toString(),
        name: section.title || '',
        code: String(config.code || ''),
        type,
        sort: section.sortOrder,
        items,
      };
    }));

    return resolved.filter(Boolean);
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

  private parseRecommendationItems(value: unknown): Array<{ id: bigint; sort: number }> {
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    return value
      .map((item: any) => {
        const targetId = String(item?.targetId || '').trim();
        if (!/^[1-9]\d*$/.test(targetId)) return null;
        try {
          const id = BigInt(targetId);
          if (id > 9223372036854775807n || seen.has(targetId)) return null;
          seen.add(targetId);
          return { id, sort: Number.isFinite(Number(item?.sort)) ? Number(item.sort) : 0 };
        } catch {
          return null;
        }
      })
      .filter((item): item is { id: bigint; sort: number } => !!item)
      .sort((a, b) => a.sort - b.sort || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .slice(0, 20);
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
