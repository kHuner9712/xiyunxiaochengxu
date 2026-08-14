import { BadRequestException } from '@nestjs/common';
import { SnapshotTemporalRuleMerchantSettlementService } from './snapshot-temporal-rule-merchant-settlement.service';

function serviceRule(overrides: Record<string, any> = {}) {
  return {
    id: 10n,
    name: '旧服务规则',
    ruleType: 'service_verification',
    merchantPromotionSourceId: null,
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
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    deletedAt: new Date('2026-08-05T00:00:00.000Z'),
    ...overrides,
  };
}

describe('SnapshotTemporalRuleMerchantSettlementService', () => {
  it('rejects manual settled status so payout accounting can only settle through a paid batch', async () => {
    const service = new SnapshotTemporalRuleMerchantSettlementService({} as any, {} as any);

    await expect(service.updateRecordStatus('1', 'settled')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rebuilds snapshot-valued service commission with the rule active at verification time', async () => {
    const prisma: any = {};
    const redis: any = {};
    const service = new SnapshotTemporalRuleMerchantSettlementService(prisma, redis);
    const occurredAt = new Date('2026-08-01T08:00:00.000Z');
    const tx: any = {
      merchantCommissionRecord: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 99n }),
      },
      merchantCommissionRule: {
        findMany: jest.fn().mockResolvedValue([
          serviceRule(),
          serviceRule({
            id: 11n,
            name: '后来的新规则',
            commissionRate: 2000,
            createdAt: new Date('2026-08-05T00:00:00.000Z'),
            deletedAt: null,
          }),
        ]),
      },
    };

    const result = await service.generateSnapshotServiceCommissionInTransaction(tx, {
      verificationLogId: 55n,
      entitlementId: 66n,
      packageItemId: 7n,
      packageId: 8n,
      pickupStoreId: 9n,
      merchantPromotionSourceId: 42n,
      sourceAmount: 8000,
      occurredAt,
    });

    expect(result).toEqual({ created: true, reason: 'created' });
    expect(tx.merchantCommissionRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ruleId: 10n,
        sourceAmount: 8000,
        commissionAmount: 800,
        occurredAt,
        dedupeKey: 'service_verification:verification_log:55',
        merchantPromotionSourceId: 42n,
        pickupStoreId: 9n,
      }),
    });
    expect(tx.merchantCommissionRecord.create.mock.calls[0][0].data.calculationSnapshot)
      .toEqual(expect.objectContaining({
        benefitValueSource: 'purchase_snapshot',
        sourceAmount: 8000,
        snapshotMerchantPromotionSourceId: '42',
        snapshotPickupStoreId: '9',
        verificationOccurredAt: occurredAt.toISOString(),
      }));
  });

  it('prefers a matching specific historical rule over a global rule at the same priority', async () => {
    const service = new SnapshotTemporalRuleMerchantSettlementService({} as any, {} as any);
    const tx: any = {
      merchantCommissionRecord: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 100n }),
      },
      merchantCommissionRule: {
        findMany: jest.fn().mockResolvedValue([
          serviceRule({ id: 20n, deletedAt: null }),
          serviceRule({
            id: 21n,
            pickupStoreId: 9n,
            commissionRate: 1500,
            deletedAt: null,
          }),
        ]),
      },
    };

    await service.generateSnapshotServiceCommissionInTransaction(tx, {
      verificationLogId: 56n,
      entitlementId: 67n,
      packageItemId: 7n,
      packageId: 8n,
      pickupStoreId: 9n,
      merchantPromotionSourceId: 42n,
      sourceAmount: 10000,
      occurredAt: new Date('2026-08-01T08:00:00.000Z'),
    });

    expect(tx.merchantCommissionRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ ruleId: 21n, commissionAmount: 1500 }),
    });
  });

  it('is idempotent by verification log independent of rule version', async () => {
    const service = new SnapshotTemporalRuleMerchantSettlementService({} as any, {} as any);
    const tx: any = {
      merchantCommissionRecord: {
        findFirst: jest.fn().mockResolvedValue({ id: 1n }),
        create: jest.fn(),
      },
      merchantCommissionRule: { findMany: jest.fn() },
    };

    const result = await service.generateSnapshotServiceCommissionInTransaction(tx, {
      verificationLogId: 55n,
      entitlementId: 66n,
      packageItemId: 7n,
      packageId: 8n,
      sourceAmount: 8000,
      occurredAt: new Date(),
    });

    expect(result).toEqual({ created: false, reason: 'already_exists' });
    expect(tx.merchantCommissionRule.findMany).not.toHaveBeenCalled();
    expect(tx.merchantCommissionRecord.create).not.toHaveBeenCalled();
  });
});
