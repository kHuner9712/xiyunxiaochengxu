import { OrderStatus } from '@prisma/client';
import { TransactionalFlashSaleService } from './transactional-flash-sale.service';

function createService(candidates: any[] = []) {
  let capturedSql = '';
  const tx: any = {
    flashSaleOrder: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    $executeRaw: jest.fn().mockResolvedValue(1),
  };
  const prisma: any = {
    $queryRaw: jest.fn().mockImplementation((strings: TemplateStringsArray) => {
      capturedSql = Array.from(strings).join('?');
      return Promise.resolve(candidates);
    }),
    $transaction: jest.fn().mockImplementation(async (callback: (client: any) => unknown) => callback(tx)),
  };
  const service = new TransactionalFlashSaleService(
    prisma,
    {} as any,
    {} as any,
    {} as any,
  );
  return { service, prisma, tx, getSql: () => capturedSql };
}

describe('TransactionalFlashSaleService payment-state recovery', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('settles a paid ordinary order immediately instead of waiting for the flash-sale lock deadline', async () => {
    const candidate = {
      id: 11n,
      orderId: 21n,
      activityId: 31n,
      quantity: 2,
      orderStatus: OrderStatus.pending_delivery,
    };
    const { service } = createService([candidate]);
    const settle = jest.spyOn(service, 'handlePaymentSuccess').mockResolvedValue(undefined);

    await expect(service.releaseExpiredLocks()).resolves.toEqual({
      released: 0,
      deferred: 0,
      settled: 1,
      failed: 0,
    });

    expect(settle).toHaveBeenCalledWith(21n);
  });

  it('releases a cancelled order reservation through a CAS transaction', async () => {
    const candidate = {
      id: 12n,
      orderId: 22n,
      activityId: 32n,
      quantity: 3,
      orderStatus: OrderStatus.cancelled,
    };
    const { service, prisma, tx } = createService([candidate]);

    await expect(service.releaseExpiredLocks()).resolves.toEqual({
      released: 1,
      deferred: 0,
      settled: 0,
      failed: 0,
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.flashSaleOrder.updateMany).toHaveBeenCalledWith({
      where: { id: 12n, status: 'pending_payment' },
      data: { status: 'expired', expiredAt: expect.any(Date) },
    });
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('builds a bounded query that admits terminal parent orders before expiry and deprioritizes still-pending parents', async () => {
    const { service, getSql } = createService([]);

    await service.releaseExpiredLocks();

    const sql = getSql().replace(/\s+/g, ' ').trim();
    expect(sql).toContain("fso.status = 'pending_payment'");
    expect(sql).toContain('OR o.status <> ?');
    expect(sql).toContain('OR fso.lock_expire_at <= NOW(3)');
    expect(sql).toContain('CASE');
    expect(sql).toContain('LIMIT 200');
  });
});