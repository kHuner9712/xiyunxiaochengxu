import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { paginate } from '@baby-mall/shared';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

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
      list.map((p) => ({ ...p, id: p.id.toString() })),
      total,
      page,
      pageSize,
    );
  }

  async getHotKeywords() {
    const cached = await this.redisService.get('search:hot_keywords');
    if (cached) {
      return JSON.parse(cached);
    }

    const keywords = await this.prisma.searchKeyword.findMany({
      where: { status: 1 },
      orderBy: { searchCount: 'desc' },
      take: 10,
      select: { id: true, keyword: true, searchCount: true },
    });

    const result = keywords.map((k) => ({ ...k, id: k.id.toString() }));

    await this.redisService.set('search:hot_keywords', JSON.stringify(result), 3600);

    return result;
  }

  async getSearchHistory(userId: string) {
    const cacheKey = `search:history:${userId}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    return [];
  }

  async addSearchHistory(userId: string, keyword: string) {
    const cacheKey = `search:history:${userId}`;
    let history: string[] = [];

    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      history = JSON.parse(cached);
    }

    history = history.filter((k) => k !== keyword);
    history.unshift(keyword);

    if (history.length > 20) {
      history = history.slice(0, 20);
    }

    await this.redisService.set(cacheKey, JSON.stringify(history), 7 * 24 * 3600);

    await this.prisma.searchKeyword.upsert({
      where: { keyword },
      update: { searchCount: { increment: 1 } },
      create: { keyword, searchCount: 1, status: 1 },
    });
  }

  async clearSearchHistory(userId: string) {
    const cacheKey = `search:history:${userId}`;
    await this.redisService.del(cacheKey);
    this.logger.log(`用户${userId}清空搜索历史`);
    return { success: true };
  }
}
