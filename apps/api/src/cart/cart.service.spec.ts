import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { CartService } from './cart.service';

function createMockPrisma() {
  return {
    cart: {
      findMany: jest.fn() as any,
      findFirst: jest.fn() as any,
      create: jest.fn() as any,
      update: jest.fn() as any,
      delete: jest.fn() as any,
      updateMany: jest.fn() as any,
      deleteMany: jest.fn() as any,
      count: jest.fn() as any,
    },
    productSku: {
      findFirst: jest.fn() as any,
    },
  };
}

describe('CartService', () => {
  let service: CartService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new CartService(prisma as any);
    jest.spyOn(service['logger'], 'log').mockImplementation(() => {});
    process.env.UPLOAD_PUBLIC_URL = 'https://api.example.com';
  });

  describe('findAll', () => {
    it('should return flattened cart items with productName/productImage/skuName/price/stock', async () => {
      prisma.cart.findMany.mockResolvedValue([{
        id: 1n,
        userId: 100n,
        productId: 10n,
        skuId: 20n,
        quantity: 2,
        isSelected: 1,
        createdAt: new Date(),
        product: {
          id: 10n,
          name: '婴儿连体衣',
          mainImage: 'product.jpg',
          status: 1,
        },
        sku: {
          id: 20n,
          specs: '红色 80cm',
          price: 9900,
          stock: 50,
          status: 1,
          image: '/uploads/sku.jpg',
        },
      }]);

      const result = await service.findAll('100');
      const item = result[0];

      expect(item.productName).toBe('婴儿连体衣');
      expect(item.productImage).toBe('https://api.example.com/uploads/sku.jpg');
      expect(item.skuName).toBe('红色 80cm');
      expect(item.price).toBe(9900);
      expect(item.quantity).toBe(2);
      expect(item.stock).toBe(50);
      expect(item.isSelected).toBe(true);
      expect(item.isValid).toBe(true);
    });

    it('should set isValid to false when product is off-sale', async () => {
      prisma.cart.findMany.mockResolvedValue([{
        id: 1n,
        userId: 100n,
        productId: 10n,
        skuId: 20n,
        quantity: 1,
        isSelected: 0,
        createdAt: new Date(),
        product: {
          id: 10n,
          name: '下架商品',
          mainImage: 'product.jpg',
          status: 2,
        },
        sku: {
          id: 20n,
          specs: { 颜色: '蓝色', 尺码: '90cm' },
          price: 5900,
          stock: 10,
          status: 1,
          image: null,
        },
      }]);

      const result = await service.findAll('100');
      expect(result[0].isValid).toBe(false);
      expect(result[0].productImage).toBe('https://api.example.com/product.jpg');
      expect(result[0].skuName).toBe('颜色：蓝色 / 尺码：90cm');
    });
  });
});
