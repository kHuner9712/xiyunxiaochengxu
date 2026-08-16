import { AsyncLocalStorage } from 'node:async_hooks';
import {
  installPickupStoreTransactionGuard,
} from './pickup-safe-order.service';
import { settleExpiredPointsBeforeCheckout } from './pickup-order-guard';

describe('checkout expired-points settlement', () => {
  it('expires only the FIFO remainder of an old lot and preserves newer unexpired points', async () => {
    const now = new Date('2026-08-16T00:00:00.000Z');
    const oldCreatedAt = new Date('2025-01-01T00:00:00.000Z');
    const pointsCreate = jest.fn().mockResolvedValue({});
    const userUpdate = jest.fn().mockResolvedValue({ availablePoints: 100 });
    const tx: any = {
      $queryRaw: jest.fn()
        .mockResolvedValueOnce([{ id: 11n, points: 100, createdAt: oldCreatedAt }])
        .mockResolvedValueOnce([{ id: 11n }])
        .mockResolvedValueOnce([]),
      pointsRecord: {
        findFirst: jest.fn().mockResolvedValue(null),
        aggregate: jest.fn()
          .mockResolvedValueOnce({ _sum: { points: 100 } })
          .mockResolvedValueOnce({ _sum: { points: 50 } }),
        create: pointsCreate,
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({ availablePoints: 150 }),
        update: userUpdate,
      },
    };

    const result = await settleExpiredPointsBeforeCheckout(tx, 1n, now);

    expect(result).toEqual({ processed: 1, deducted: 50 });
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: 1n },
      data: { availablePoints: { decrement: 50 } },
      select: { availablePoints: true },
    });
    expect(pointsCreate).toHaveBeenCalledWith({
      data: {
        userId: 1n,
        type: 3,
        points: 50,
        balance: 100,
        source: 'expire',
        sourceId: 11n,
        description: '积分到期，按FIFO扣除该笔剩余50积分',
      },
    });
  });

  it('settles overdue points under the checkout user lock before the order callback can consume points', async () => {
    const oldCreatedAt = new Date('2025-01-01T00:00:00.000Z');
    const orderCreate = jest.fn(async () => ({ id: 99n }));
    const userUpdate = jest.fn().mockResolvedValue({ availablePoints: 100 });
    const tx: any = {
      $queryRaw: jest.fn()
        // lockActiveCheckoutUser
        .mockResolvedValueOnce([{ id: 1n }])
        // first due-points batch
        .mockResolvedValueOnce([{ id: 11n, points: 100, createdAt: oldCreatedAt }])
        // candidate row lock
        .mockResolvedValueOnce([{ id: 11n }])
        // second batch: drained
        .mockResolvedValueOnce([]),
      pointsRecord: {
        findFirst: jest.fn().mockResolvedValue(null),
        aggregate: jest.fn()
          .mockResolvedValueOnce({ _sum: { points: 100 } })
          .mockResolvedValueOnce({ _sum: { points: 50 } }),
        create: jest.fn().mockResolvedValue({}),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({ availablePoints: 150 }),
        update: userUpdate,
      },
      order: { create: orderCreate },
    };
    const prisma: any = {
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    };
    const storage = new AsyncLocalStorage<any>();
    installPickupStoreTransactionGuard(prisma, storage);

    const result = await storage.run(
      { userId: 1n, pointsDeduct: 100 },
      () => prisma.$transaction((guardedTx: any) => guardedTx.order.create({
        data: { userId: 1n, fulfillmentType: 'delivery' },
      })),
    );

    expect(result).toEqual({ id: 99n });
    expect(userUpdate).toHaveBeenCalledTimes(1);
    expect(orderCreate).toHaveBeenCalledTimes(1);
    expect(userUpdate.mock.invocationCallOrder[0]).toBeLessThan(
      orderCreate.mock.invocationCallOrder[0],
    );
  });
});
