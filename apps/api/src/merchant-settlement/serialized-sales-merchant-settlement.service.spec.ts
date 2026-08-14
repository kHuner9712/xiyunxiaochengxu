import { BadRequestException } from '@nestjs/common';
import { ProductionMerchantSettlementService } from './production-merchant-settlement.service';
import { RefundSafeProductionMerchantSettlementService } from './refund-safe-production-merchant-settlement.service';
import { SerializedSalesMerchantSettlementService } from './serialized-sales-merchant-settlement.service';

function createHarness(options?: {
  acquired?: boolean;
  existing?: { id: bigint } | null;
  sourceCode?: string | null;
  merchantId?: bigint;
}) {
  const merchantId = options?.merchantId ?? 42n;
  const tx: any = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    merchantCommissionRecord: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    merchantSettlementItem: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
  };
  const prisma: any = {
    merchantPromotionSource: {
      findFirst: jest.fn().mockResolvedValue({ id: merchantId }),
    },
    merchantCommissionRecord: {
      findFirst: jest.fn().mockResolvedValue(options?.existing ?? null),
    },
    order: {
      findUnique: jest.fn().mockResolvedValue({
        sourceType: 'merchant_referral',
        sourceCode: options?.sourceCode === undefined ? 'MERCHANT-001' : options.sourceCode,
      }),
    },
    $queryRaw: jest.fn().mockResolvedValue([]),
    $transaction: jest.fn(async (callback: any) => callback(tx)),
  };
  const redis: any = {
    setNX: jest.fn().mockResolvedValue(options?.acquired ?? true),
    releaseLockWithLua: jest.fn().mockResolvedValue(true),
  };
  return {
    service: new SerializedSalesMerchantSettlementService(prisma, redis),
    prisma,
    redis,
    tx,
  };
}

describe('SerializedSalesMerchantSettlementService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('serializes commission creation by immutable merchant id and releases the lock', async () => {
    const inherited = jest
      .spyOn(ProductionMerchantSettlementService.prototype, 'generateSalesCommission')
      .mockResolvedValue(undefined);
    const { service, redis } = createHarness({ merchantId: 42n });

    await service.generateSalesCommission(1n, 2n, 10000, 'merchant_referral', 'MERCHANT-001');

    expect(redis.setNX).toHaveBeenCalledWith(
      'merchant:settlement:sales:42',
      expect.any(String),
      120,
    );
    expect(inherited).toHaveBeenCalledWith(1n, 2n, 10000, 'merchant_referral', 'MERCHANT-001');
    expect(redis.releaseLockWithLua).toHaveBeenCalledTimes(1);
  });

  it('does not create a second sales-referral ledger row when the order already has one', async () => {
    const inherited = jest
      .spyOn(ProductionMerchantSettlementService.prototype, 'generateSalesCommission')
      .mockResolvedValue(undefined);
    const { service, prisma, redis } = createHarness({ existing: { id: 99n } });

    await service.generateSalesCommission(1n, 2n, 10000, 'merchant_referral', 'MERCHANT-001');

    expect(prisma.merchantCommissionRecord.findFirst).toHaveBeenCalledWith({
      where: { orderId: 1n, sourceType: 'sales_referral', deletedAt: null },
      select: { id: true },
    });
    expect(inherited).not.toHaveBeenCalled();
    expect(redis.releaseLockWithLua).toHaveBeenCalledTimes(1);
  });

  it('uses the same merchant-id lock boundary for generation and refund reversal', async () => {
    jest
      .spyOn(ProductionMerchantSettlementService.prototype, 'generateSalesCommission')
      .mockResolvedValue(undefined);
    const reverse = jest
      .spyOn(RefundSafeProductionMerchantSettlementService.prototype, 'reverseSalesCommissionAfterRefund')
      .mockResolvedValue({ adjusted: 1, debtCreated: 0 });
    const { service, prisma, redis } = createHarness({ merchantId: 42n });

    await service.generateSalesCommission(1n, 2n, 10000, 'merchant_referral', 'MERCHANT-001');
    const generationKey = redis.setNX.mock.calls[0][0];

    prisma.merchantCommissionRecord.findFirst.mockResolvedValueOnce({
      merchantPromotionSourceId: 42n,
    });
    await service.reverseSalesCommissionAfterRefund(1n, 7n);
    const refundKey = redis.setNX.mock.calls[1][0];

    expect(generationKey).toBe('merchant:settlement:sales:42');
    expect(refundKey).toBe(generationKey);
    expect(reverse).toHaveBeenCalledWith(1n, 7n);
    expect(redis.releaseLockWithLua).toHaveBeenCalledTimes(2);
  });

  it('fails closed when another process owns the merchant accounting lock', async () => {
    const inherited = jest
      .spyOn(ProductionMerchantSettlementService.prototype, 'generateSalesCommission')
      .mockResolvedValue(undefined);
    const { service, redis } = createHarness({ acquired: false });

    await expect(
      service.generateSalesCommission(1n, 2n, 10000, 'merchant_referral', 'MERCHANT-001'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(inherited).not.toHaveBeenCalled();
    expect(redis.releaseLockWithLua).not.toHaveBeenCalled();
  });

  it('reconciles a commission row left pending after a crash before refund-debt consumption', async () => {
    const { service, prisma, tx } = createHarness({ merchantId: 42n });
    prisma.$queryRaw.mockResolvedValueOnce([{ recordId: 10n, merchantId: 42n }]);
    tx.merchantCommissionRecord.findUnique.mockResolvedValueOnce({
      id: 10n,
      deletedAt: null,
      merchantPromotionSourceId: 42n,
      sourceType: 'sales_referral',
      status: 'pending',
      commissionAmount: 100,
    });
    tx.merchantCommissionRecord.findMany.mockResolvedValueOnce([
      {
        id: 20n,
        commissionAmount: -60,
        remark: '历史退款负债',
      },
    ]);

    const result = await service.reconcileOutstandingSalesDebts(200);

    expect(result).toEqual({ total: 1, reconciled: 1, skipped: 0, failed: 0 });
    expect(tx.merchantCommissionRecord.update).toHaveBeenCalledWith({
      where: { id: 20n },
      data: expect.objectContaining({ commissionAmount: 0, status: 'settled' }),
    });
    expect(tx.merchantCommissionRecord.update).toHaveBeenCalledWith({
      where: { id: 10n },
      data: expect.objectContaining({ commissionAmount: 40 }),
    });
  });
});
