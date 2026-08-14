import { StateSafeProductionMerchantSettlementService } from './state-safe-production-merchant-settlement.service';

describe('StateSafeProductionMerchantSettlementService batch locking', () => {
  it('locks current candidate rows before any ordinary Prisma read establishes a RR snapshot', async () => {
    const record = {
      id: 1n,
      deletedAt: null,
      status: 'pending',
      occurredAt: new Date('2026-08-01T00:00:00.000Z'),
      sourceAmount: 10000,
      commissionAmount: 1000,
      confirmedAt: null,
      merchantPromotionSourceId: 42n,
      pickupStoreId: 9n,
      sourceType: 'sales_referral',
      orderId: 100n,
      verificationLogId: null,
    };
    const batch = {
      id: 20n,
      settlementNo: 'SETTLE-TEST',
      merchantPromotionSourceId: 42n,
      pickupStoreId: 9n,
      periodStart: new Date('2026-07-01T00:00:00.000Z'),
      periodEnd: new Date('2026-09-01T00:00:00.000Z'),
      recordCount: 1,
      totalSourceAmount: 10000,
      totalCommissionAmount: 1000,
      status: 'draft',
      remark: null,
    };
    const tx: any = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 1n }]),
      merchantCommissionRecord: {
        findMany: jest.fn().mockResolvedValue([record]),
      },
      merchantSettlementItem: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 10n,
          batchId: 20n,
          commissionRecordId: 1n,
          amount: 1000,
          status: 'included',
        }),
      },
      merchantSettlementBatch: {
        create: jest.fn().mockResolvedValue(batch),
      },
      businessEvent: {
        create: jest.fn().mockResolvedValue({ id: 30n }),
      },
    };
    const prisma: any = {
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    };
    const service = new StateSafeProductionMerchantSettlementService(prisma);

    await expect(
      service.createBatch({
        merchantPromotionSourceId: '42',
        pickupStoreId: '9',
        periodStart: '2026-07-01T00:00:00.000Z',
        periodEnd: '2026-09-01T00:00:00.000Z',
      }),
    ).resolves.toEqual(batch);

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.merchantCommissionRecord.findMany).toHaveBeenCalledWith({
      where: { id: { in: [1n] } },
      orderBy: { id: 'asc' },
    });
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.merchantCommissionRecord.findMany.mock.invocationCallOrder[0],
    );

    const lockingQuery = tx.$queryRaw.mock.calls[0][0];
    const sqlText = Array.isArray(lockingQuery?.strings)
      ? lockingQuery.strings.join(' ')
      : String(lockingQuery);
    expect(sqlText).toContain('merchant_commission_records');
    expect(sqlText).toContain('FOR UPDATE');
    expect(sqlText).toContain('commission_amount > 0');
    expect(tx.merchantSettlementItem.create).toHaveBeenCalledWith({
      data: {
        batchId: 20n,
        commissionRecordId: 1n,
        amount: 1000,
        status: 'included',
      },
    });
  });
});
