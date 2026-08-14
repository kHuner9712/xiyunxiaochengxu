import { describe, expect, it, jest } from '@jest/globals';
import { CartService } from './cart.service';

function rawCart() {
  return {
    id: 9n,
    userId: 100n,
    productId: 10n,
    skuId: 20n,
    quantity: 2,
    isSelected: 1,
    createdAt: new Date('2026-08-14T00:00:00.000Z'),
    updatedAt: new Date('2026-08-14T00:00:00.000Z'),
  };
}

function createService() {
  let removeEvent: any = null;
  const prisma: any = {
    cart: {
      findFirst: jest.fn<any>(),
      delete: jest.fn<any>(),
    },
    businessEvent: {
      findFirst: jest.fn<any>(async ({ where }: any) => {
        if (where.eventType === 'cart_remove') return removeEvent;
        return null;
      }),
      create: jest.fn<any>(async ({ data }: any) => {
        if (data.eventType === 'cart_remove') removeEvent = { id: 71n, ...data };
        return { id: 71n, ...data };
      }),
    },
    $queryRaw: jest.fn<any>().mockResolvedValue([{ id: 100n }]),
  };
  prisma.$transaction = jest.fn(async (callback: any) => callback(prisma));
  const service = new CartService(prisma);
  jest.spyOn(service['logger'], 'log').mockImplementation(() => {});
  return { service, prisma };
}

describe('CartService removeItem durable idempotency', () => {
  it('hard-deletes once and replays the committed deletion by owned cart id', async () => {
    const { service, prisma } = createService();
    const cart = rawCart();
    prisma.cart.findFirst.mockResolvedValueOnce(cart);
    prisma.cart.delete.mockResolvedValueOnce(cart);

    const first = await service.removeItem('100', '9');
    const retry = await service.removeItem('100', '9');

    expect(first).toMatchObject({ id: '9', userId: '100', productId: '10', skuId: '20' });
    expect(retry).toMatchObject({ id: '9', userId: '100', productId: '10', skuId: '20' });
    expect(prisma.cart.delete).toHaveBeenCalledTimes(1);
    expect(prisma.cart.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.businessEvent.create).toHaveBeenCalledTimes(1);
    expect(prisma.businessEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: 'cart_remove',
        bizType: 'cart:100',
        bizId: '9',
        payload: {
          cart: expect.objectContaining({ id: '9', userId: '100', productId: '10', skuId: '20' }),
        },
      }),
    });
  });

  it('keeps unknown or foreign cart ids fail-closed when no owned deletion fact exists', async () => {
    const { service, prisma } = createService();
    prisma.cart.findFirst.mockResolvedValue(null);

    await expect(service.removeItem('100', '9')).rejects.toThrow('购物车记录不存在');

    expect(prisma.businessEvent.create).not.toHaveBeenCalled();
    expect(prisma.cart.delete).not.toHaveBeenCalled();
  });
});
