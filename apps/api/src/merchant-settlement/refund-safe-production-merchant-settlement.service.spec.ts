import { RefundSafeProductionMerchantSettlementService } from './refund-safe-production-merchant-settlement.service';

function createHarness(options?: {
  priorDebts?: any[];
  outerStatus?: string;
  lockedStatus?: string;
  outerItemStatus?: string | null;
  lockedItemStatus?: string | null;
  outerBatchStatus?: string | null;
  lockedBatchStatus?: string | null;
}) {
  const record = {
    id: 10n,
    ruleId: 20n,
    merchantPromotionSourceId: 30n,
    userId: 40n,
    orderId: 1n,
    sourceType: 'sales_referral',
    sourceAmount: 10000,
    commissionAmount: 1000,
    calculationSnapshot: { sourceAmount: 10000, finalAmount: 1000 },
    status: options?.outerStatus ?? 'settled',
    deletedAt: null,
  };
  const lockedRecord = {
    ...record,
    status: options?.lockedStatus ?? record.status,
  };
  const outerItem = options?.outerItemStatus == null
    ? null
    : { id: 51n, batchId: 60n, commissionRecordId: record.id, amount: 1000, status: options.outerItemStatus };
  const lockedItem = options?.lockedItemStatus == null
    ? outerItem
    : { id: 51n, batchId: 60n, commissionRecordId: record.id, amount: 1000, status: options.lockedItemStatus };
  const outerBatch = options?.outerBatchStatus == null
    ? null
    : { id: 60n, status: options.outerBatchStatus };
  const lockedBatch = options?.lockedBatchStatus == null
    ? outerBatch
    : { id: 60n, status: options.lockedBatchStatus };

  const tx: any = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: record.id }]),
    merchantCommissionRecord: {
      findUnique: jest.fn().mockResolvedValue(lockedRecord),
      findMany: jest.fn().mockResolvedValue(options?.priorDebts ?? []),
      create: jest.fn().mockResolvedValue({ id: 99n }),
      update: jest.fn().mockResolvedValue(lockedRecord),
    },
    merchantSettlementItem: {
      findUnique: jest.fn().mockResolvedValue(lockedItem),
      update: jest.fn().mockResolvedValue(lockedItem),
    },
    merchantSettlementBatch: {
      findUnique: jest.fn().mockResolvedValue(lockedBatch),
      update: jest.fn().mockResolvedValue(lockedBatch),
    },
  };

  const prisma: any = {
    order: {
      findUnique: jest.fn().mockResolvedValue({ id: 1n, payAmount: 10000 }),
    },
    orderRefund: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { refundAmount: 10000 } }),
    },
    merchantCommissionRecord: {
      findMany: jest.fn().mockResolvedValue([record]),
    },
    merchantSettlementItem: {
      findUnique: jest.fn().mockResolvedValue(outerItem),
    },
    merchantSettlementBatch: {
      findUnique: jest.fn().mockResolvedValue(outerBatch),
    },
    $transaction: jest.fn(async (callback: any) => callback(tx)),
  };

  return {
    service: new RefundSafeProductionMerchantSettlementService(prisma),
    prisma,
    tx,
  };
}

describe('RefundSafeProductionMerchantSettlementService', () => {
  it('creates only the incremental debt across multiple settled partial refunds even when the first debt was already offset', async () => {
    const { service, tx } = createHarness({
      priorDebts: [
        {
          sourceAmount: -5000,
          commissionAmount: 0,
          calculationSnapshot: {
            originalRecordId: '10',
            reversalAmount: 500,
            sourceReversalAmount: 5000,
          },
        },
      ],
    });

    const result = await service.reverseSalesCommissionAfterRefund(1n, 202n);

    expect(result).toEqual({ adjusted: 0, debtCreated: 1 });
    expect(tx.merchantCommissionRecord.create).toHaveBeenCalledTimes(1);
    expect(tx.merchantCommissionRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sourceType: 'sales_referral_refund_debt',
        sourceAmount: -5000,
        commissionAmount: -500,
        calculationSnapshot: expect.objectContaining({
          originalRecordId: '10',
          previousRecognizedReversal: 500,
          targetCumulativeReversal: 1000,
          reversalAmount: 500,
          sourceReversalAmount: 5000,
        }),
      }),
    });
  });

  it('does not create another debt after the cumulative reversal has already been fully recognized', async () => {
    const { service, tx } = createHarness({
      priorDebts: [
        {
          sourceAmount: -10000,
          commissionAmount: 0,
          calculationSnapshot: {
            originalRecordId: '10',
            reversalAmount: 1000,
            sourceReversalAmount: 10000,
          },
        },
      ],
    });

    const result = await service.reverseSalesCommissionAfterRefund(1n, 203n);

    expect(result).toEqual({ adjusted: 0, debtCreated: 0 });
    expect(tx.merchantCommissionRecord.create).not.toHaveBeenCalled();
  });

  it('switches to incremental debt when a commission becomes settled after the outer read', async () => {
    const { service, tx } = createHarness({
      outerStatus: 'pending',
      lockedStatus: 'settled',
      outerItemStatus: 'included',
      lockedItemStatus: 'settled',
      outerBatchStatus: 'building',
      lockedBatchStatus: 'paid',
    });

    const result = await service.reverseSalesCommissionAfterRefund(1n, 204n);

    expect(result).toEqual({ adjusted: 0, debtCreated: 1 });
    expect(tx.merchantCommissionRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        commissionAmount: -1000,
        sourceAmount: -10000,
      }),
    });
    expect(tx.merchantCommissionRecord.update).not.toHaveBeenCalled();
  });
});
