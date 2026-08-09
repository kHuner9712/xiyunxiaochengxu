import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { HomeService } from './home.service';

function createMockPrisma() {
  return {
    product: {
      findMany: jest.fn() as any,
      count: jest.fn() as any,
    },
    banner: {
      findMany: jest.fn() as any,
    },
    activity: {
      findMany: jest.fn() as any,
    },
    content: {
      findMany: jest.fn() as any,
    },
    babyProfile: {
      findFirst: jest.fn() as any,
    },
    systemConfig: {
      findFirst: jest.fn() as any,
    },
    homeSection: {
      findFirst: jest.fn() as any,
      findMany: jest.fn() as any,
    },
  };
}

describe('HomeService', () => {
  let service: HomeService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    process.env.UPLOAD_PUBLIC_URL = 'https://api.example.com';
    prisma = createMockPrisma();
    prisma.homeSection.findMany.mockResolvedValue([]);
    prisma.homeSection.findFirst.mockResolvedValue(null);
    prisma.systemConfig.findFirst.mockResolvedValue(null);
    prisma.content.findMany.mockResolvedValue([]);
    service = new HomeService(prisma as any);
  });

  describe('getHomeData', () => {
    it('should return quickEntries, recommendations and monthRecommend fields', async () => {
      prisma.banner.findMany.mockResolvedValue([]);
      prisma.product.findMany.mockResolvedValue([]);
      prisma.activity.findMany.mockResolvedValue([]);

      const result = await service.getHomeData();

      expect(result).toHaveProperty('banners');
      expect(result).toHaveProperty('quickEntries');
      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('monthRecommend');
      expect(result).toHaveProperty('hotProducts');
      expect(result).toHaveProperty('newProducts');
      expect(result).toHaveProperty('activities');
      expect(result.quickEntries).toEqual([]);
      expect(result.recommendations).toEqual([]);
    });

    it('should expose managed recommendations without restoring the obsolete monthAgeRecommend alias', async () => {
      prisma.banner.findMany.mockResolvedValue([]);
      prisma.activity.findMany.mockResolvedValue([]);
      prisma.homeSection.findMany.mockResolvedValue([{
        id: 9n,
        type: 'recommendation',
        title: '首页精选',
        sortOrder: 10,
        status: 1,
        config: {
          code: 'home_featured',
          recommendationType: 1,
          items: [{ targetId: '7', targetName: '旧客户端名称不会被信任', sort: 1 }],
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      }]);
      prisma.product.findMany.mockImplementation((args: any) => {
        if (args.where?.id?.in) {
          return Promise.resolve([{
            id: 7n,
            name: '服务端商品名',
            mainImage: '/uploads/recommendation.jpg',
            minPrice: 8800,
            totalSales: 12,
          }]);
        }
        return Promise.resolve([]);
      });

      const result = await service.getHomeData();

      expect(result.recommendations).toHaveLength(1);
      expect(result.recommendations[0]).toMatchObject({
        id: '9',
        name: '首页精选',
        code: 'home_featured',
        type: 1,
      });
      expect(result.recommendations[0]?.items[0]).toMatchObject({
        id: '7',
        name: '服务端商品名',
        image: 'https://api.example.com/uploads/recommendation.jpg',
        price: 8800,
      });
      expect(result).not.toHaveProperty('monthAgeRecommend');
    });
  });

  describe('product serialization', () => {
    it('should return ProductCardVO fields for hotProducts', async () => {
      (prisma.product.findMany as any).mockImplementation((args: any) => {
        if (args.orderBy?.totalSales) {
          return Promise.resolve([{
            id: 1n, name: '测试商品', mainImage: 'img.jpg', minPrice: 9900, totalSales: 50,
          }]);
        }
        return Promise.resolve([]);
      });
      prisma.banner.findMany.mockResolvedValue([]);
      prisma.activity.findMany.mockResolvedValue([]);

      const result = await service.getHomeData();
      const product = result.hotProducts[0];

      expect(product).toHaveProperty('id', '1');
      expect(product).toHaveProperty('name', '测试商品');
      expect(product).toHaveProperty('image', 'https://api.example.com/img.jpg');
      expect(product).toHaveProperty('price', 9900);
      expect(product).toHaveProperty('originalPrice');
      expect(product).toHaveProperty('sales', 50);
      expect(product).not.toHaveProperty('mainImage');
      expect(product).not.toHaveProperty('minPrice');
      expect(product).not.toHaveProperty('totalSales');
    });
  });

  describe('activity serialization', () => {
    it('should include image field from bannerImage', async () => {
      prisma.banner.findMany.mockResolvedValue([]);
      prisma.product.findMany.mockResolvedValue([]);
      prisma.activity.findMany.mockResolvedValue([{
        id: 1n, name: '限时折扣', type: 'flash_sale',
        bannerImage: 'activity.jpg', startTime: new Date(), endTime: new Date(),
      }]);

      const result = await service.getHomeData();
      const activity = result.activities[0];

      expect(activity).toHaveProperty('image', 'https://api.example.com/activity.jpg');
      expect(activity).toHaveProperty('id', '1');
    });
  });

  describe('getGuessProducts', () => {
    it('should normalize image url for guess product cards', async () => {
      prisma.product.findMany.mockResolvedValue([
        { id: 2n, name: '猜你喜欢商品', mainImage: '/uploads/guess.jpg', minPrice: 10900, totalSales: 8 },
      ]);
      prisma.product.count.mockResolvedValue(1);

      const result = await service.getGuessProducts(1, 10);

      expect(result.list[0]).toMatchObject({
        id: '2',
        name: '猜你喜欢商品',
        image: 'https://api.example.com/uploads/guess.jpg',
        price: 10900,
      });
    });
  });
});
