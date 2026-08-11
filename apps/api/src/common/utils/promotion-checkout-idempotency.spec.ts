import { AsyncLocalStorage } from 'node:async_hooks';
import {
  buildPromotionCheckoutOrderNo,
  createPromotionCheckoutPrismaProxy,
  PromotionCheckoutIdempotencyContext,
} from './promotion-checkout-idempotency';

describe('promotion checkout idempotency primitives', () => {
  const requestId = '1786449600000-abcdefghijklmnopqrstuvwx';

  it('maps the same user, scope and request id to the same order number', () => {
    const first = buildPromotionCheckoutOrderNo(7n, 'flash-sale:101', requestId);
    const second = buildPromotionCheckoutOrderNo('7', 'flash-sale:101', requestId);
    expect(first).toBe(second);
    expect(first).toMatch(/^XY\d{14}[a-f0-9]{12}$/);
  });

  it('separates different promotion scopes even when a client reuses the request id', () => {
    const flash = buildPromotionCheckoutOrderNo(7n, 'flash-sale:101', requestId);
    const group = buildPromotionCheckoutOrderNo(7n, 'group-buy:start:101', requestId);
    expect(group).not.toBe(flash);
  });

  it('injects the deterministic order number only inside the request-local transaction', async () => {
    const orderCreate = jest.fn(async (args: any) => args.data);
    const nativeTransaction = jest.fn(async (callback: any) => callback({
      order: { create: orderCreate },
    }));
    const originalPrisma = { $transaction: nativeTransaction } as any;
    const originalTransactionReference = originalPrisma.$transaction;
    const storage = new AsyncLocalStorage<PromotionCheckoutIdempotencyContext>();
    const proxied = createPromotionCheckoutPrismaProxy(originalPrisma, storage) as any;

    const result = await storage.run(
      { userId: '7', orderNo: 'XY20260811200000abcdef123456' },
      () => proxied.$transaction((tx: any) => tx.order.create({
        data: { userId: 7n, orderNo: 'random-order-no' },
      })),
    );

    expect(orderCreate).toHaveBeenCalledWith({
      data: { userId: 7n, orderNo: 'XY20260811200000abcdef123456' },
    });
    expect(result.orderNo).toBe('XY20260811200000abcdef123456');
    expect(originalPrisma.$transaction).toBe(originalTransactionReference);
  });

  it('does not replace order numbers for another user in the same transaction', async () => {
    const orderCreate = jest.fn(async (args: any) => args.data);
    const nativeTransaction = jest.fn(async (callback: any) => callback({
      order: { create: orderCreate },
    }));
    const storage = new AsyncLocalStorage<PromotionCheckoutIdempotencyContext>();
    const proxied = createPromotionCheckoutPrismaProxy(
      { $transaction: nativeTransaction } as any,
      storage,
    ) as any;

    const result = await storage.run(
      { userId: '7', orderNo: 'XY20260811200000abcdef123456' },
      () => proxied.$transaction((tx: any) => tx.order.create({
        data: { userId: 8n, orderNo: 'other-user-order' },
      })),
    );

    expect(result.orderNo).toBe('other-user-order');
  });
});
