import { AsyncLocalStorage } from 'node:async_hooks';
import { AttributionSafeMemberBenefitOrderService } from './attribution-safe-member-benefit-order.service';
import {
  createOrderIdempotencyPrismaProxy,
  IdempotentAttributionSafeMemberBenefitOrderService,
} from './idempotent-attribution-safe-member-benefit-order.service';

const CLIENT_REQUEST_ID = '1786449600000-abcdefghijklmnopqrstuvwx';

function existingOrder() {
  return {
    id: 88n,
    orderNo: 'XY20260811120000abcdef123456',
    payAmount: 1990,
    status: 'pending_payment',
    fulfillmentType: 'delivery',
  };
}

function createBareService(findFirst: jest.Mock) {
  const service = Object.create(IdempotentAttributionSafeMemberBenefitOrderService.prototype) as any;
  service.idempotentPrisma = { order: { findFirst } };
  service.orderCreateIdempotency = new AsyncLocalStorage();
  return service as IdempotentAttributionSafeMemberBenefitOrderService;
}

describe('IdempotentAttributionSafeMemberBenefitOrderService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('same client request id always maps to the same deterministic order number', () => {
    const service = createBareService(jest.fn()) as any;
    const first = service.buildDeterministicOrderNo('7', CLIENT_REQUEST_ID);
    const second = service.buildDeterministicOrderNo('7', CLIENT_REQUEST_ID);
    expect(first).toBe(second);
    expect(first).toMatch(/^XY\d{14}[a-f0-9]{12}$/);
  });

  it('returns the already committed order without creating another order', async () => {
    const findFirst = jest.fn().mockResolvedValue(existingOrder());
    const service = createBareService(findFirst);
    const createSpy = jest.spyOn(AttributionSafeMemberBenefitOrderService.prototype, 'create').mockResolvedValue({} as any);
    const result = await service.create('7', {
      clientRequestId: CLIENT_REQUEST_ID,
      addressId: '1',
      items: [{ skuId: '2', quantity: 1 }],
    } as any);
    expect(result).toMatchObject({ orderId: '88', payAmount: 1990, isZeroPay: false });
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('recovers the winner order after a concurrent unique-order-number race', async () => {
    const findFirst = jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(existingOrder());
    const service = createBareService(findFirst);
    jest.spyOn(AttributionSafeMemberBenefitOrderService.prototype, 'create').mockRejectedValueOnce(new Error('Unique constraint failed on order_no'));
    const result = await service.create('7', {
      clientRequestId: CLIENT_REQUEST_ID,
      addressId: '1',
      items: [{ skuId: '2', quantity: 1 }],
    } as any);
    expect(result).toMatchObject({ orderId: '88', orderNo: existingOrder().orderNo });
    expect(findFirst).toHaveBeenCalledTimes(2);
  });

  it('does not hide a real create failure when no idempotent order exists', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const service = createBareService(findFirst);
    jest.spyOn(AttributionSafeMemberBenefitOrderService.prototype, 'create').mockRejectedValueOnce(new Error('库存不足'));
    await expect(service.create('7', {
      clientRequestId: CLIENT_REQUEST_ID,
      addressId: '1',
      items: [{ skuId: '2', quantity: 1 }],
    } as any)).rejects.toThrow('库存不足');
  });

  it('injects the deterministic order number only through the service-local Prisma proxy', async () => {
    const orderCreate = jest.fn(async (args: any) => args.data);
    const nativeTransaction = jest.fn(async (callback: any) => callback({ order: { create: orderCreate } }));
    const originalPrisma = { $transaction: nativeTransaction } as any;
    const originalTransactionReference = originalPrisma.$transaction;
    const storage = new AsyncLocalStorage<any>();
    const proxiedPrisma = createOrderIdempotencyPrismaProxy(originalPrisma, storage) as any;

    const result = await storage.run(
      { userId: '7', orderNo: 'XY20260811120000abcdef123456' },
      () => proxiedPrisma.$transaction((tx: any) => tx.order.create({
        data: { userId: 7n, orderNo: 'random-order-no' },
      })),
    );

    expect(orderCreate).toHaveBeenCalledWith({
      data: { userId: 7n, orderNo: 'XY20260811120000abcdef123456' },
    });
    expect(result.orderNo).toBe('XY20260811120000abcdef123456');
    expect(originalPrisma.$transaction).toBe(originalTransactionReference);
  });

  it('keeps inherited transaction-hook assignments on the proxy instead of mutating shared Prisma', async () => {
    const nativeTransaction = jest.fn(async () => 'native');
    const originalPrisma = { $transaction: nativeTransaction } as any;
    const storage = new AsyncLocalStorage<any>();
    const proxiedPrisma = createOrderIdempotencyPrismaProxy(originalPrisma, storage) as any;
    const localHook = jest.fn(async () => 'local');

    proxiedPrisma.$transaction = localHook;

    expect(originalPrisma.$transaction).toBe(nativeTransaction);
    await expect(proxiedPrisma.$transaction(() => undefined)).resolves.toBe('local');
    expect(localHook).toHaveBeenCalledTimes(1);
    expect(nativeTransaction).not.toHaveBeenCalled();
  });

  it('constructing the local Prisma proxy does not require $transaction until a transaction is actually used', () => {
    const partialPrisma = { order: { findFirst: jest.fn() } } as any;
    expect(() => createOrderIdempotencyPrismaProxy(partialPrisma, new AsyncLocalStorage<any>())).not.toThrow();
  });
});
