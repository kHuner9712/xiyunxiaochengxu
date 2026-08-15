import { AsyncLocalStorage } from 'node:async_hooks';
import { COUPON_STATUS } from '../common/constants/payment';
import { installPickupStoreTransactionGuard } from './pickup-safe-order.service';

describe('checkout coupon freshness guard', () => {
  it('rechecks expireAt on the actual FREE -> LOCKED write inside the checkout transaction', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const tx: any = {
      $queryRaw: jest.fn().mockResolvedValueOnce([{ id: 1n }]),
      userCoupon: { updateMany },
    };
    const prisma: any = {
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    };
    const storage = new AsyncLocalStorage<any>();
    installPickupStoreTransactionGuard(prisma, storage);

    await storage.run(
      { userId: 1n },
      () => prisma.$transaction((guardedTx: any) => guardedTx.userCoupon.updateMany({
        where: {
          id: 8n,
          userId: 1n,
          status: COUPON_STATUS.FREE,
        },
        data: { status: COUPON_STATUS.LOCKED },
      })),
    );

    expect(updateMany).toHaveBeenCalledTimes(1);
    const args = updateMany.mock.calls[0][0];
    expect(args.where).toEqual(expect.objectContaining({
      id: 8n,
      userId: 1n,
      status: COUPON_STATUS.FREE,
      expireAt: { gte: expect.any(Date) },
    }));
    expect(args.data).toEqual({ status: COUPON_STATUS.LOCKED });
  });

  it('does not rewrite unrelated coupon updates', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const tx: any = {
      $queryRaw: jest.fn().mockResolvedValueOnce([{ id: 1n }]),
      userCoupon: { updateMany },
    };
    const prisma: any = {
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    };
    const storage = new AsyncLocalStorage<any>();
    installPickupStoreTransactionGuard(prisma, storage);

    await storage.run(
      { userId: 1n },
      () => prisma.$transaction((guardedTx: any) => guardedTx.userCoupon.updateMany({
        where: { id: 8n, status: COUPON_STATUS.LOCKED },
        data: { usedOrderId: 99n },
      })),
    );

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 8n, status: COUPON_STATUS.LOCKED },
      data: { usedOrderId: 99n },
    });
  });
});
