import { BadRequestException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { TemporalRuleMerchantSettlementService } from './temporal-rule-merchant-settlement.service';

function salesRule(overrides: Record<string, any> = {}) {
  return {
    id: 1n,
    name: '历史销售规则',
    ruleType: 'sales_referral',
    merchantPromotionSourceId: 42n,
    pickupStoreId: null,
    benefitPackageId: null,
    benefitPackageItemId: null,
    calculationType: 'percent',
    commissionRate: 1000,
    commissionAmount: null,
    minCommissionAmount: null,
    maxCommissionAmount: null,
    effectiveStartAt: null,
    effectiveEndAt: null,
    status: 1,
    priority: 10,
    remark: null,
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
    deletedAt: new Date('2026-08-05T00:00:00.000Z'),
    ...overrides,
  };
}

function createHarness() {
  const tx: any = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    merchantCommissionRule: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    merchantCommissionRecord: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
    },
    benefitPackageItem: {
      findFirst: jest.fn(),
    },
  };
  const prisma: any = {
    order: { findUnique: jest.fn() },
    orderRefund: { aggregate: jest.fn() },
    merchantPromotionSource: { findFirst: jest.fn() },
    merchantCommissionRule: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    merchantCommissionRecord: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    $queryRaw: jest.fn().mockResolvedValue([]),
    $transaction: jest.fn(async (callback: any) => callback(tx)),
  };
  const redis: any = {
    setNX: jest.fn().mockResolvedValue(true),
    releaseLockWithLua: jest.fn().mockResolvedValue(true),
  };
  return {
    service: new TemporalRuleMerchantSettlementService(prisma, redis),
    prisma,
    redis,
    tx,
  };
}

describe('TemporalRuleMerchantSettlementService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('prices a matured sale with the rule version that existed at paidAt, not a newer rule', async () => {
    const { service, prisma } = createHarness();
    const paidAt = new Date('2026-08-01T08:00:00.000Z');
    prisma.order.findUnique.mockResolvedValue({
      id: 100n,
      userId: 9n,
      status: OrderStatus.completed,
      completedAt: new Date('2026-08-02T08:00:00.000Z'),
      paidAt,
      payAmount: 10000,
      pickupStoreId: null,
      sourceType: 'merchant_referral',
      sourceCode: 'MERCHANT-001',
    });
    prisma.orderRefund.aggregate.mockResolvedValue({ _sum: { refundAmount: 0 } });
    prisma.merchantPromotionSource.findFirst.mockResolvedValue({ id: 42n });
    prisma.merchantCommissionRecord.findFirst.mockResolvedValue(null);
    prisma.merchantCommissionRule.findMany.mockResolvedValue([
      salesRule(),
      salesRule({
        id: 2n,
        name: '今天的新规则',
        commissionRate: 2000,
        createdAt: new Date('2026-08-05T00:00:00.000Z'),
        deletedAt: null,
      }),
    ]);
    prisma.merchantCommissionRecord.create.mockResolvedValue({ id: 500n });

    await service.generateSalesCommission(100n, 9n, 10000, 'merchant_referral', 'MERCHANT-001');

    expect(prisma.merchantCommissionRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ruleId: 1n,
        orderId: 100n,
        sourceAmount: 10000,
        commissionAmount: 1000,
        occurredAt: paidAt,
        dedupeKey: 'sales_referral:order:100:merchant:42',
      }),
    });
    expect(prisma.merchantCommissionRecord.create.mock.calls[0][0].data.calculationSnapshot)
      .toEqual(expect.objectContaining({
        salesOccurredAt: paidAt.toISOString(),
        salesOccurredAtSource: 'paidAt',
      }));
  });

  it('honors optional sales scope: blank means global and a mismatched store rule cannot win', async () => {
    const { service, prisma } = createHarness();
    prisma.order.findUnique.mockResolvedValue({
      id: 101n,
      userId: 9n,
      status: OrderStatus.completed,
      completedAt: new Date('2026-08-01T00:00:00.000Z'),
      paidAt: new Date('2026-07-31T00:00:00.000Z'),
      payAmount: 10000,
      pickupStoreId: 7n,
      sourceType: 'merchant_referral',
      sourceCode: 'MERCHANT-001',
    });
    prisma.orderRefund.aggregate.mockResolvedValue({ _sum: { refundAmount: 0 } });
    prisma.merchantPromotionSource.findFirst.mockResolvedValue({ id: 42n });
    prisma.merchantCommissionRecord.findFirst.mockResolvedValue(null);
    prisma.merchantCommissionRule.findMany.mockResolvedValue([
      salesRule({ id: 3n, pickupStoreId: 99n, priority: 999 }),
      salesRule({
        id: 4n,
        merchantPromotionSourceId: null,
        pickupStoreId: null,
        priority: 1,
        deletedAt: null,
      }),
    ]);

    await service.generateSalesCommission(101n, 9n, 10000, 'merchant_referral', 'MERCHANT-001');

    expect(prisma.merchantCommissionRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ ruleId: 4n }),
    });
  });

  it('versions a financial rule edit instead of rewriting the historical row', async () => {
    const { service, tx } = createHarness();
    const current = salesRule({ deletedAt: null, pickupStoreId: 7n });
    tx.merchantCommissionRule.findUnique.mockResolvedValue(current);
    tx.merchantCommissionRule.update.mockResolvedValue({});
    tx.merchantCommissionRule.create.mockImplementation(async ({ data }: any) => ({ id: 2n, ...data }));

    const result = await service.updateRule('1', { commissionRate: 2000 });

    expect(tx.merchantCommissionRule.update).toHaveBeenCalledWith({
      where: { id: 1n },
      data: { deletedAt: expect.any(Date) },
    });
    expect(tx.merchantCommissionRule.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        commissionRate: 2000,
        merchantPromotionSourceId: 42n,
        pickupStoreId: 7n,
        createdAt: expect.any(Date),
      }),
    });
    const retiredAt = tx.merchantCommissionRule.update.mock.calls[0][0].data.deletedAt;
    const replacementCreatedAt = tx.merchantCommissionRule.create.mock.calls[0][0].data.createdAt;
    expect(replacementCreatedAt).toEqual(retiredAt);
    expect(result.id).toBe(2n);
  });

  it('refuses to retire a currently active rule now for a replacement that only starts in the future', async () => {
    const { service, tx } = createHarness();
    tx.merchantCommissionRule.findUnique.mockResolvedValue(
      salesRule({ deletedAt: null, effectiveStartAt: null, effectiveEndAt: null, status: 1 }),
    );

    await expect(
      service.updateRule('1', {
        commissionRate: 2000,
        effectiveStartAt: '2100-01-01T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.merchantCommissionRule.update).not.toHaveBeenCalled();
    expect(tx.merchantCommissionRule.create).not.toHaveBeenCalled();
  });

  it('preserves omitted partial-update fields and allows explicit nullable fields to be cleared', async () => {
    const { service, tx } = createHarness();
    const current = salesRule({
      deletedAt: null,
      minCommissionAmount: 100,
      maxCommissionAmount: 500,
      pickupStoreId: 7n,
    });
    tx.merchantCommissionRule.findUnique.mockResolvedValue(current);
    tx.merchantCommissionRule.update.mockResolvedValue({});
    tx.merchantCommissionRule.create.mockImplementation(async ({ data }: any) => ({ id: 2n, ...data }));

    await service.updateRule('1', { maxCommissionAmount: null });

    expect(tx.merchantCommissionRule.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        merchantPromotionSourceId: 42n,
        pickupStoreId: 7n,
        minCommissionAmount: 100,
        maxCommissionAmount: null,
        priority: 10,
      }),
    });
  });

  it('rejects cross-field rule ranges that DTO field validators cannot express', async () => {
    const { service, prisma } = createHarness();

    await expect(service.createRule({
      name: '非法规则',
      ruleType: 'sales_referral',
      calculationType: 'percent',
      commissionRate: 1000,
      minCommissionAmount: 600,
      maxCommissionAmount: 500,
      effectiveStartAt: '2026-08-10T00:00:00.000Z',
      effectiveEndAt: '2026-08-09T00:00:00.000Z',
    })).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.merchantCommissionRule.create).not.toHaveBeenCalled();
  });

  it('rebuilds a missing service commission from the rule version active at verification time', async () => {
    const { service, tx } = createHarness();
    const occurredAt = new Date('2026-08-01T08:00:00.000Z');
    tx.benefitPackageItem.findFirst.mockResolvedValue({ id: 7n, originalValue: 5000 });
    tx.merchantCommissionRule.findMany.mockResolvedValue([
      salesRule({
        id: 10n,
        name: '旧服务规则',
        ruleType: 'service_verification',
        merchantPromotionSourceId: null,
        calculationType: 'fixed_amount',
        commissionRate: null,
        commissionAmount: 500,
        deletedAt: new Date('2026-08-05T00:00:00.000Z'),
      }),
      salesRule({
        id: 11n,
        name: '新服务规则',
        ruleType: 'service_verification',
        merchantPromotionSourceId: null,
        calculationType: 'fixed_amount',
        commissionRate: null,
        commissionAmount: 1000,
        createdAt: new Date('2026-08-05T00:00:00.000Z'),
        deletedAt: null,
      }),
    ]);
    tx.merchantCommissionRecord.create.mockResolvedValue({ id: 99n });

    const result = await service.generateServiceCommissionInTransaction(tx, {
      verificationLogId: 55n,
      entitlementId: 66n,
      packageItemId: 7n,
      packageId: 8n,
      pickupStoreId: null,
      merchantPromotionSourceId: null,
      occurredAt,
    });

    expect(result).toEqual({ created: true, reason: 'created' });
    expect(tx.merchantCommissionRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ruleId: 10n,
        commissionAmount: 500,
        occurredAt,
        dedupeKey: 'service_verification:verification_log:55',
      }),
    });
  });
});
