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
    systemConfig: {
      findFirst: jest.fn() as any,
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
    redis.del.mockResolvedValue(undefined);
    prisma.systemConfig.findFirst.mockResolvedValue(null);
    service = new SearchService(prisma as any, redis as any);
    jest.spyOn(service['logger'], 'warn').mockImplementation(() => {});
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

  it('should prioritize configured home-decor hot keywords and fill with organic search terms without duplicates', async () => {
    prisma.systemConfig.findFirst.mockResolvedValue({
      configValue: JSON.stringify({ hotKeywords: [' 奶粉 ', '纸尿裤', '奶粉'] }),
    });
    prisma.searchKeyword.findMany.mockResolvedValue([
      { keyword: '奶粉' },
      { keyword: '湿巾' },
      { keyword: '奶瓶' },
    ]);

    const result = await service.getHotKeywords();

    expect(result).toEqual(['奶粉', '纸尿裤', '湿巾', '奶瓶']);
    expect(redis.set).toHaveBeenCalledWith(
      'search:hot_keywords',
      JSON.stringify(['奶粉', '纸尿裤', '湿巾', '奶瓶']),
      3600,
    );
  });

  it('should return organic hot keywords when no manual configuration exists', async () => {
    prisma.searchKeyword.findMany.mockResolvedValue([
      { keyword: '奶粉' },
      { keyword: '纸尿裤' },
    ]);

    const result = await service.getHotKeywords();

    expect(result).toEqual(['奶粉', '纸尿裤']);
    expect(redis.set).toHaveBeenCalledWith('search:hot_keywords', JSON.stringify(['奶粉', '纸尿裤']), 3600);
  });

  it('should normalize legacy cached hot keyword objects to strings without querying database', async () => {
    redis.get.mockResolvedValueOnce(JSON.stringify([
      { id: '1', keyword: '奶瓶', searchCount: 12 },
      '湿巾',
    ]));

    const result = await service.getHotKeywords();

    expect(result).toEqual(['奶瓶', '湿巾']);
    expect(prisma.searchKeyword.findMany).not.toHaveBeenCalled();
    expect(prisma.systemConfig.findFirst).not.toHaveBeenCalled();
  });

  it('should rebuild malformed hot keyword cache instead of throwing a public 500', async () => {
    redis.get.mockResolvedValueOnce('{bad-json');
    prisma.systemConfig.findFirst.mockResolvedValue({
      configValue: JSON.stringify({ hotKeywords: ['人工热词'] }),
    });
    prisma.searchKeyword.findMany.mockResolvedValue([{ keyword: '自然热词' }]);

    const result = await service.getHotKeywords();

    expect(result).toEqual(['人工热词', '自然热词']);
    expect(redis.del).toHaveBeenCalledWith('search:hot_keywords');
    expect(redis.set).toHaveBeenCalledWith(
      'search:hot_keywords',
      JSON.stringify(['人工热词', '自然热词']),
      3600,
    );
  });

  it('should ignore malformed home-decor JSON and still serve organic keywords', async () => {
    prisma.systemConfig.findFirst.mockResolvedValue({ configValue: '{bad-home-config' });
    prisma.searchKeyword.findMany.mockResolvedValue([{ keyword: '自然热词' }]);

    const result = await service.getHotKeywords();

    expect(result).toEqual(['自然热词']);
  });

  it('should return empty history for anonymous users without reading redis', async () => {
    const result = await service.getSearchHistory();

    expect(result).toEqual([]);
    expect(redis.get).not.toHaveBeenCalled();
  });

  it('should clear malformed search history cache instead of throwing', async () => {
    redis.get.mockResolvedValueOnce('{bad-history');

    const result = await service.getSearchHistory('88');

    expect(result).toEqual([]);
    expect(redis.del).toHaveBeenCalledWith('search:history:88');
  });

  it('should rebuild malformed history when adding a new search keyword', async () => {
    redis.get.mockResolvedValueOnce('{bad-history');
    prisma.searchKeyword.upsert.mockResolvedValue({});

    await service.addSearchHistory('88', ' 奶粉 ');

    expect(redis.set).toHaveBeenCalledWith(
      'search:history:88',
      JSON.stringify(['奶粉']),
      7 * 24 * 3600,
    );
    expect(prisma.searchKeyword.upsert).toHaveBeenCalledWith({
      where: { keyword: '奶粉' },
      update: { searchCount: { increment: 1 } },
      create: { keyword: '奶粉', searchCount: 1, status: 1 },
    });
  });

  it('should treat anonymous clear history as a no-op', async () => {
    const result = await service.clearSearchHistory();

    expect(result).toEqual({ success: true });
    expect(redis.del).not.toHaveBeenCalled();
  });
});
