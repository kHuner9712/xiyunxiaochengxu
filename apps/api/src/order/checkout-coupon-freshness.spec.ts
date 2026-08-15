import { AsyncLocalStorage } from 'node:async_hooks';
import { COUPON_STATUS } from '../common/constants/payment';
import { installPickupStoreTransactionGuard } from './pickup-safe-order.service';

describe('checkout coupon freshness guard', () => {
  it('rechecks expiry on the actual FREE -> LOCKED write while allowing non-expiring coupons', async () => {
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
    }));
    expect(args.where.AND).toEqual([
      {
        OR: [
          { expireAt: null },
          { expireAt: { gte: expect.any(Date) } },
        ],
      },
    ]);
    expect(args.data).toEqual({ status: COUPON_STATUS.LOCKED });
  });

  it('preserves existing AND predicates when adding the final expiry freshness condition', async () => {
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
    const existingPredicate = { couponId: 7n };

    await storage.run(
      { userId: 1n },
      () => prisma.$transaction((guardedTx: any) => guardedTx.userCoupon.updateMany({
        where: {
          id: 8n,
          userId: 1n,
          status: COUPON_STATUS.FREE,
          AND: existingPredicate,
        },
        data: { status: COUPON_STATUS.LOCKED },
      })),
    );

    const args = updateMany.mock.calls[0][0];
    expect(args.where.AND[0]).toEqual(existingPredicate);
    expect(args.where.AND[1]).toEqual({
      OR: [
        { expireAt: null },
        { expireAt: { gte: expect.any(Date) } },
      ],
    });
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