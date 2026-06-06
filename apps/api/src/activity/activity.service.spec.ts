import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ActivityService } from './activity.service';

function createMockPrisma() {
  return {
    activity: {
      findFirst: jest.fn() as any,
    },
  };
}

describe('ActivityService', () => {
  let service: ActivityService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    process.env.UPLOAD_PUBLIC_URL = 'https://api.example.com';
    prisma = createMockPrisma();
    service = new ActivityService(prisma as any);
  });

  it('should expose banner image alias and ProductCard-compatible products', async () => {
    prisma.activity.findFirst.mockResolvedValue({
      id: 1n,
      name: '限时活动',
      type: 'flash_sale',
      description: '活动说明',
      bannerImage: '/uploads/activity.jpg',
      startTime: new Date('2026-06-06T00:00:00.000Z'),
      endTime: new Date('2026-06-07T00:00:00.000Z'),
      activityProducts: [{
        id: 10n,
        activityId: 1n,
        productId: 20n,
        skuId: 30n,
        activityPrice: 8900,
        activityStock: 8,
        product: {
          id: 20n,
          name: '活动奶粉',
          mainImage: '/uploads/product.jpg',
          minPrice: 9900,
          totalSales: 66,
        },
        sku: {
          id: 30n,
          image: '',
          price: 9900,
          originalPrice: 10900,
          stock: 12,
        },
      }],
    });

    const result = await service.findById('1');

    expect(result.bannerImage).toBe('https://api.example.com/uploads/activity.jpg');
    expect(result.image).toBe('https://api.example.com/uploads/activity.jpg');
    expect(result.products[0]).toMatchObject({
      id: '20',
      name: '活动奶粉',
      image: 'https://api.example.com/uploads/product.jpg',
      price: 8900,
      originalPrice: 10900,
      sales: 66,
      activityPrice: 8900,
      stock: 8,
    });
    expect(result.activityProducts[0].product.mainImage).toBe('https://api.example.com/uploads/product.jpg');
  });
});
