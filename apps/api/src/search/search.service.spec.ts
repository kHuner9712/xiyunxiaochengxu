import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { SearchService } from './search.service';

function createMockPrisma() {
  return {
    product: {
      findMany: jest.fn() as any,
      count: jest.fn() as any,
    },
    searchKeyword: {
      findMany: jest.fn() as any,
      upsert: jest.fn() as any,
    },
  };
}

function createMockRedis() {
  return {
    get: jest.fn() as any,
    set: jest.fn() as any,
    del: jest.fn() as any,
  };
}

describe('SearchService', () => {
  let service: SearchService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let redis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    process.env.UPLOAD_PUBLIC_URL = 'https://api.example.com';
    prisma = createMockPrisma();
    redis = createMockRedis();
    redis.get.mockResolvedValue(null);
    service = new SearchService(prisma as any, redis as any);
  });

  it('should return ProductCardVO fields with normalized image urls', async () => {
    prisma.product.findMany.mockResolvedValue([{
      id: 1n,
      name: '测试奶粉',
      mainImage: '/uploads/milk.jpg',
      minPrice: 12900,
      totalSales: 37,
      isRecommend: 1,
    }]);
    prisma.product.count.mockResolvedValue(1);

    const result = await service.search('奶粉', 1, 10);
    const product = result.list[0];

    expect(product).toMatchObject({
      id: '1',
      name: '测试奶粉',
      image: 'https://api.example.com/uploads/milk.jpg',
      price: 12900,
      originalPrice: 12900,
      sales: 37,
      tag: '推荐',
    });
    expect(product).not.toHaveProperty('mainImage');
    expect(product).not.toHaveProperty('minPrice');
    expect(product).not.toHaveProperty('totalSales');
  });

  it('should provide fallback image and numeric card fields when source product fields are empty', async () => {
    prisma.product.findMany.mockResolvedValue([{
      id: 2n,
      name: '无图商品',
      mainImage: null,
      minPrice: null,
      totalSales: 0,
      isRecommend: 0,
    }]);
    prisma.product.count.mockResolvedValue(1);

    const result = await service.search('无图', 1, 10);

    expect(result.list[0]).toMatchObject({
      id: '2',
      image: '/static/default-cover.png',
      price: 0,
      originalPrice: 0,
      sales: 0,
    });
  });

  it('should return hot keywords as string array and cache the same contract', async () => {
    prisma.searchKeyword.findMany.mockResolvedValue([
      { keyword: '奶粉' },
      { keyword: '纸尿裤' },
    ]);

    const result = await service.getHotKeywords();

    expect(result).toEqual(['奶粉', '纸尿裤']);
    expect(redis.set).toHaveBeenCalledWith('search:hot_keywords', JSON.stringify(['奶粉', '纸尿裤']), 3600);
  });

  it('should normalize legacy cached hot keyword objects to strings', async () => {
    redis.get.mockResolvedValueOnce(JSON.stringify([
      { id: '1', keyword: '奶瓶', searchCount: 12 },
      '湿巾',
    ]));

    const result = await service.getHotKeywords();

    expect(result).toEqual(['奶瓶', '湿巾']);
    expect(prisma.searchKeyword.findMany).not.toHaveBeenCalled();
  });

  it('should return empty history for anonymous users without reading redis', async () => {
    const result = await service.getSearchHistory();

    expect(result).toEqual([]);
    expect(redis.get).not.toHaveBeenCalled();
  });

  it('should treat anonymous clear history as a no-op', async () => {
    const result = await service.clearSearchHistory();

    expect(result).toEqual({ success: true });
    expect(redis.del).not.toHaveBeenCalled();
  });
});
