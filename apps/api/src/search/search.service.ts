import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { paginate, serializeProductCard } from '@baby-mall/shared';
import { getAssetBaseUrl, normalizeAssetUrl } from '../common/utils/asset-url';

const HOT_KEYWORDS_CACHE_KEY = 'search:hot_keywords';
const HOT_KEYWORDS_LIMIT = 20;
const SEARCH_HISTORY_LIMIT = 20;
const SEARCH_HISTORY_TTL_SECONDS = 7 * 24 * 3600;

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private readonly assetBaseUrl = getAssetBaseUrl();

  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {}

  async search(keyword: string, page: number = 1, pageSize: number = 10, sort?: string, userId?: string) {
    const where: any = {
      deletedAt: null,
      status: 1,
    };

    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { description: { contains: keyword } },
      ];
    }

    let orderBy: any = { totalSales: 'desc' };
    if (sort === 'price_asc') orderBy = { minPrice: 'asc' };
    else if (sort === 'price_desc') orderBy = { minPrice: 'desc' };
    else if (sort === 'new') orderBy = { createdAt: 'desc' };
    else if (sort === 'sales') orderBy = { totalSales: 'desc' };

    const [list, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          name: true,
          mainImage: true,
          minPrice: true,
          totalSales: true,
          isRecommend: true,
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    if (keyword && userId) {
      await this.addSearchHistory(userId, keyword);
    }

    return paginate(
      list.map((p) => ({
        ...serializeProductCard(p),
        image: normalizeAssetUrl(p.mainImage, this.assetBaseUrl) || '/static/default-cover.png',
      })),
      total,
      page,
      pageSize,
    );
  }

  async getHotKeywords() {
    const cached = await this.redisService.get(HOT_KEYWORDS_CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          return this.normalizeHotKeywords(parsed, HOT_KEYWORDS_LIMIT);
        }
        this.logger.warn('搜索热词缓存结构无效，重新构建');
      } catch (error) {
        this.logger.warn(`搜索热词缓存损坏，重新构建：${(error as Error).message}`);
      }
      await this.redisService.del(HOT_KEYWORDS_CACHE_KEY).catch(() => undefined);
    }

    const [configured, organic] = await Promise.all([
      this.getConfiguredHotKeywords(),
      this.prisma.searchKeyword.findMany({
        where: { status: 1 },
        orderBy: { searchCount: 'desc' },
        take: HOT_KEYWORDS_LIMIT,
        select: { keyword: true },
      }),
    ]);

    const result = this.mergeHotKeywords(configured, organic);
    await this.redisService.set(HOT_KEYWORDS_CACHE_KEY, JSON.stringify(result), 3600);
    return result;
  }

  async getSearchHistory(userId?: string) {
    if (!userId) return [];

    const cacheKey = `search:history:${userId}`;
    const cached = await this.redisService.get(cacheKey);
    if (!cached) return [];

    const history = this.parseSearchHistory(cached);
    if (history !== null) return history;

    this.logger.warn(`用户${userId}搜索历史缓存损坏，已清理`);
    await this.redisService.del(cacheKey).catch(() => undefined);
    return [];
  }

  async addSearchHistory(userId: string, keyword: string) {
    const normalizedKeyword = keyword.trim();
    if (!normalizedKeyword) return;

    const cacheKey = `search:history:${userId}`;
    let history: string[] = [];
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      const parsed = this.parseSearchHistory(cached);
      if (parsed) {
        history = parsed;
      } else {
        this.logger.warn(`用户${userId}搜索历史缓存损坏，按空历史重建`);
      }
    }

    history = history.filter((item) => item !== normalizedKeyword);
    history.unshift(normalizedKeyword);
    history = history.slice(0, SEARCH_HISTORY_LIMIT);

    await this.redisService.set(cacheKey, JSON.stringify(history), SEARCH_HISTORY_TTL_SECONDS);

    await this.prisma.searchKeyword.upsert({
      where: { keyword: normalizedKeyword },
      update: { searchCount: { increment: 1 } },
      create: { keyword: normalizedKeyword, searchCount: 1, status: 1 },
    });
    await this.redisService.del(HOT_KEYWORDS_CACHE_KEY).catch(() => undefined);
  }

  async clearSearchHistory(userId?: string) {
    if (!userId) return { success: true };

    const cacheKey = `search:history:${userId}`;
    await this.redisService.del(cacheKey);
    this.logger.log(`用户${userId}清空搜索历史`);
    return { success: true };
  }

  private async getConfiguredHotKeywords(): Promise<string[]> {
    const config = await this.prisma.systemConfig.findFirst({
      where: { groupName: 'home_decor', configKey: 'config' },
      select: { configValue: true },
    });
    if (!config?.configValue) return [];

    try {
      const parsed = JSON.parse(config.configValue);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return [];
      return this.normalizeHotKeywords((parsed as Record<string, unknown>).hotKeywords, HOT_KEYWORDS_LIMIT);
    } catch (error) {
      this.logger.warn(`首页装修热词配置损坏，忽略人工热词：${(error as Error).message}`);
      return [];
    }
  }

  private mergeHotKeywords(configured: unknown, organic: unknown): string[] {
    return this.normalizeHotKeywords([
      ...this.normalizeHotKeywords(configured, HOT_KEYWORDS_LIMIT),
      ...this.normalizeHotKeywords(organic, HOT_KEYWORDS_LIMIT),
    ], HOT_KEYWORDS_LIMIT);
  }

  private normalizeHotKeywords(value: unknown, limit = HOT_KEYWORDS_LIMIT): string[] {
    if (!Array.isArray(value)) return [];
    const normalized: string[] = [];
    const seen = new Set<string>();
    for (const item of value) {
      let keyword = '';
      if (typeof item === 'string') keyword = item;
      else if (item && typeof item === 'object' && 'keyword' in item) {
        keyword = String((item as { keyword?: unknown }).keyword || '');
      }
      keyword = keyword.trim();
      if (!keyword || keyword.length > 80 || seen.has(keyword)) continue;
      seen.add(keyword);
      normalized.push(keyword);
      if (normalized.length >= limit) break;
    }
    return normalized;
  }

  private parseSearchHistory(cached: string): string[] | null {
    try {
      const parsed = JSON.parse(cached);
      if (!Array.isArray(parsed)) return null;
      return this.normalizeHotKeywords(parsed, SEARCH_HISTORY_LIMIT);
    } catch {
      return null;
    }
  }
}
