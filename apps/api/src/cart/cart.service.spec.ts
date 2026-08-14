import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { CartService } from './cart.service';

function createMockPrisma() {
  const prisma: any = {
    cart: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
    productSku: {
      findFirst: jest.fn(),
    },
    businessEvent: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };
  prisma.$transaction = jest.fn(async (callback: any) => callback(prisma));
  return prisma;
}

function rawCart(overrides: Record<string, any> = {}) {
  return {
    id: 1n,
    userId: 100n,
    productId: 10n,
    skuId: 20n,
    quantity: 2,
    isSelected: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const REQUEST_ID = '1760000000000-abcdefghijklmnopqrstuvwx';

describe('CartService', () => {
  let service: CartService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    prisma.$queryRaw.mockResolvedValue([{ id: 100n }]);
    prisma.businessEvent.findFirst.mockResolvedValue(null);
    prisma.businessEvent.create.mockResolvedValue({ id: 99n });
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

    it('marks off-sale or insufficient-stock rows invalid', async () => {
      prisma.cart.findMany.mockResolvedValue([
        {
          id: 1n,
          userId: 100n,
          productId: 10n,
          skuId: 20n,
          quantity: 1,
          isSelected: 0,
          createdAt: new Date(),
          product: { id: 10n, name: '下架商品', mainImage: 'product.jpg', status: 2 },
          sku: { id: 20n, specs: { 颜色: '蓝色' }, price: 5900, stock: 10, status: 1, image: null },
        },
        {
          id: 2n,
          userId: 100n,
          productId: 11n,
          skuId: 21n,
          quantity: 3,
          isSelected: 0,
          createdAt: new Date(),
          product: { id: 11n, name: '库存不足', mainImage: 'stock.jpg', status: 1 },
          sku: { id: 21n, specs: null, price: 6900, stock: 2, status: 1, image: null },
        },
      ]);

      const result = await service.findAll('100');
      expect(result[0].isValid).toBe(false);
      expect(result[1].isValid).toBe(false);
    });
  });

  describe('addItem idempotency', () => {
    it('replays a committed incremental add instead of adding the same quantity twice', async () => {
      const sku = {
        id: 20n,
        productId: 10n,
        stock: 50,
        status: 1,
        product: { id: 10n, status: 1 },
      };
      const before = rawCart({ quantity: 1 });
      const after = rawCart({ quantity: 3 });
      let durableEvent: any = null;

      prisma.productSku.findFirst.mockResolvedValue(sku);
      prisma.cart.findFirst
        .mockResolvedValueOnce(before)
        .mockResolvedValueOnce(after);
      prisma.cart.update.mockResolvedValue(after);
      prisma.businessEvent.findFirst.mockImplementation(async () => durableEvent);
      prisma.businessEvent.create.mockImplementation(async ({ data }: any) => {
        durableEvent = { id: 71n, ...data };
        return durableEvent;
      });

      const dto = {
        productId: '10',
        skuId: '20',
        quantity: 2,
        clientRequestId: REQUEST_ID,
      };

      const first = await service.addItem('100', dto);
      const retry = await service.addItem('100', dto);

      expect(first.quantity).toBe(3);
      expect(retry.quantity).toBe(3);
      expect(prisma.cart.update).toHaveBeenCalledTimes(1);
      expect(prisma.productSku.findFirst).toHaveBeenCalledTimes(1);
      expect(prisma.businessEvent.create).toHaveBeenCalledTimes(1);
      expect(prisma.businessEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'cart_add',
          bizType: 'cart:100',
          bizId: REQUEST_ID,
          payload: expect.objectContaining({ cartId: '1' }),
        }),
      });
    });

    it('fails closed if the same add request id is reused with a different quantity', async () => {
      const sku = {
        id: 20n,
        productId: 10n,
        stock: 50,
        status: 1,
        product: { id: 10n, status: 1 },
      };
      let durableEvent: any = null;
      prisma.productSku.findFirst.mockResolvedValue(sku);
      prisma.cart.findFirst.mockResolvedValue(rawCart({ quantity: 1 }));
      prisma.cart.update.mockResolvedValue(rawCart({ quantity: 2 }));
      prisma.businessEvent.findFirst.mockImplementation(async () => durableEvent);
      prisma.businessEvent.create.mockImplementation(async ({ data }: any) => {
        durableEvent = { id: 72n, ...data };
        return durableEvent;
      });

      await service.addItem('100', {
        productId: '10', skuId: '20', quantity: 1, clientRequestId: REQUEST_ID,
      });

      await expect(service.addItem('100', {
        productId: '10', skuId: '20', quantity: 2, clientRequestId: REQUEST_ID,
      })).rejects.toThrow('加购请求ID已被其他操作使用');

      expect(prisma.cart.update).toHaveBeenCalledTimes(1);
      expect(prisma.businessEvent.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('ownership guard', () => {
    it('updateItem scopes cart item by current user id', async () => {
      prisma.cart.findFirst.mockResolvedValue(null);

      await expect(service.updateItem('100', { id: '9', quantity: 2 })).rejects.toThrow('购物车记录不存在');

      expect(prisma.cart.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 9n, userId: 100n },
      }));
      expect(prisma.cart.update).not.toHaveBeenCalled();
    });

    it('removeItem refuses cart item owned by another user', async () => {
      prisma.cart.findFirst.mockResolvedValue(null);

      await expect(service.removeItem('100', '9')).rejects.toThrow('购物车记录不存在');

      expect(prisma.cart.delete).not.toHaveBeenCalled();
    });

    it('select all clears stale selections then selects only currently purchasable rows', async () => {
      prisma.cart.updateMany
        .mockResolvedValueOnce({ count: 3 })
        .mockResolvedValueOnce({ count: 1 });
      prisma.cart.findMany.mockResolvedValue([
        { id: 1n, quantity: 2, product: { status: 1 }, sku: { status: 1, stock: 5 } },
        { id: 2n, quantity: 2, product: { status: 2 }, sku: { status: 1, stock: 5 } },
        { id: 3n, quantity: 4, product: { status: 1 }, sku: { status: 1, stock: 3 } },
      ]);

      const result = await service.selectAll('100', 1);

      expect(prisma.cart.updateMany).toHaveBeenNthCalledWith(1, {
        where: { userId: 100n },
        data: { isSelected: 0 },
      });
      expect(prisma.cart.updateMany).toHaveBeenNthCalledWith(2, {
        where: { userId: 100n, id: { in: [1n] } },
        data: { isSelected: 1 },
      });
      expect(result.updatedCount).toBe(1);
    });

    it('removeSelected is transactionally scoped to current user id', async () => {
      prisma.cart.deleteMany.mockResolvedValue({ count: 1 });

      await service.removeSelected('100');

      expect(prisma.cart.deleteMany).toHaveBeenCalledWith({
        where: { userId: 100n, isSelected: 1 },
      });
    });
  });
});
