import { BadRequestException } from '@nestjs/common';
import { ProductionMerchantSettlementService } from './production-merchant-settlement.service';
import { RefundSafeProductionMerchantSettlementService } from './refund-safe-production-merchant-settlement.service';
import { SerializedSalesMerchantSettlementService } from './serialized-sales-merchant-settlement.service';

function createHarness(options?: {
  acquired?: boolean;
  existing?: { id: bigint } | null;
  sourceCode?: string | null;
}) {
  const prisma: any = {
    merchantCommissionRecord: {
      findFirst: jest.fn().mockResolvedValue(options?.existing ?? null),
    },
    order: {
      findUnique: jest.fn().mockResolvedValue({
        sourceType: 'merchant_referral',
        sourceCode: options?.sourceCode === undefined ? 'MERCHANT-001' : options.sourceCode,
      }),
    },
  };
  const redis: any = {
    setNX: jest.fn().mockResolvedValue(options?.acquired ?? true),
    releaseLockWithLua: jest.fn().mockResolvedValue(true),
  };
  return {
    service: new SerializedSalesMerchantSettlementService(prisma, redis),
    prisma,
    redis,
  };
}

describe('SerializedSalesMerchantSettlementService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('serializes commission creation and releases the merchant lock', async () => {
    const inherited = jest
      .spyOn(ProductionMerchantSettlementService.prototype, 'generateSalesCommission')
      .mockResolvedValue(undefined);
    const { service, redis } = createHarness();

    await service.generateSalesCommission(1n, 2n, 10000, 'merchant_referral', 'MERCHANT-001');

    expect(redis.setNX).toHaveBeenCalledWith(
      expect.stringMatching(/^merchant:settlement:sales:[0-9a-f]{64}$/),
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

  it('uses the same merchant lock boundary for generation and refund reversal', async () => {
    jest
      .spyOn(ProductionMerchantSettlementService.prototype, 'generateSalesCommission')
      .mockResolvedValue(undefined);
    const reverse = jest
      .spyOn(RefundSafeProductionMerchantSettlementService.prototype, 'reverseSalesCommissionAfterRefund')
      .mockResolvedValue({ adjusted: 1, debtCreated: 0 });
    const { service, redis } = createHarness();

    await service.generateSalesCommission(1n, 2n, 10000, 'merchant_referral', 'MERCHANT-001');
    const generationKey = redis.setNX.mock.calls[0][0];
    await service.reverseSalesCommissionAfterRefund(1n, 7n);
    const refundKey = redis.setNX.mock.calls[1][0];

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
});
