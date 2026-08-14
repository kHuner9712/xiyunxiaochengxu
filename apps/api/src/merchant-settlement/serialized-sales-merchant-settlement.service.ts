import { BadRequestException, Injectable } from '@nestjs/common';
import { AFTERSALE_APPLY_DAYS } from '@baby-mall/shared';
import * as crypto from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { SnapshotAwareStateSafeMerchantSettlementService } from './snapshot-aware-state-safe-merchant-settlement.service';

const SALES_SETTLEMENT_LOCK_TTL_SECONDS = 120;
const DEBT_RECONCILE_BATCH_SIZE = 200;

type BatchScope = {
  merchantPromotionSourceId?: string;
  pickupStoreId?: string;
  periodStart?: string;
  periodEnd?: string;
};

type DebtCandidate = {
  recordId: bigint;
  merchantId: bigint;
};

/**
 * Serializes sales-commission accounting per immutable merchant id.
 *
 * Sales commission is single-rule by design: one merchant referral order must never gain a second
 * `sales_referral` ledger row merely because the active rule changed between retries. The same
 * merchant boundary protects outstanding refund-debt consumption and refund reversal. It also
 * provides a durable reconciliation path for the crash window between creating a commission row
 * and consuming historical refund debt.
 */
@Injectable()
export class SerializedSalesMerchantSettlementService extends SnapshotAwareStateSafeMerchantSettlementService {
  constructor(
    private readonly serializedPrisma: PrismaService,
    private readonly serializedRedis: RedisService,
  ) {
    super(serializedPrisma);
  }

  override async generateSalesCommission(
    orderId: bigint | string,
    userId: bigint | string,
    payAmount: number,
    sourceType: string,
    sourceCode: string,
  ): Promise<void> {
    if (sourceType !== 'merchant_referral' || !sourceCode) {
      return super.generateSalesCommission(orderId, userId, payAmount, sourceType, sourceCode);
    }

    const merchant = await this.serializedPrisma.merchantPromotionSource.findFirst({
      where: { promotionCode: sourceCode, deletedAt: null },
      select: { id: true },
    });
    if (!merchant) {
      return super.generateSalesCommission(orderId, userId, payAmount, sourceType, sourceCode);
    }

    await this.withMerchantSalesLock(merchant.id, async () => {
      const existing = await this.serializedPrisma.merchantCommissionRecord.findFirst({
        where: {
          orderId: BigInt(orderId),
          sourceType: 'sales_referral',
          deletedAt: null,
        },
        select: { id: true },
      });
      if (existing) return;

      await super.generateSalesCommission(orderId, userId, payAmount, sourceType, sourceCode);
    });
  }

  override async reverseSalesCommissionAfterRefund(
    orderId: bigint | string,
    refundId: bigint | string,
  ) {
    const normalizedOrderId = BigInt(orderId);
    const existingRecord = await this.serializedPrisma.merchantCommissionRecord.findFirst({
      where: {
        orderId: normalizedOrderId,
        sourceType: 'sales_referral',
        deletedAt: null,
      },
      select: { merchantPromotionSourceId: true },
    });

    let merchantId = existingRecord?.merchantPromotionSourceId ?? null;
    if (!merchantId) {
      const order = await this.serializedPrisma.order.findUnique({
        where: { id: normalizedOrderId },
        select: { sourceType: true, sourceCode: true },
      });
      if (order?.sourceType !== 'merchant_referral' || !order.sourceCode) {
        return super.reverseSalesCommissionAfterRefund(orderId, refundId);
      }
      const merchant = await this.serializedPrisma.merchantPromotionSource.findFirst({
        where: { promotionCode: order.sourceCode, deletedAt: null },
        select: { id: true },
      });
      merchantId = merchant?.id ?? null;
    }

    if (!merchantId) {
      return super.reverseSalesCommissionAfterRefund(orderId, refundId);
    }

    return this.withMerchantSalesLock(merchantId, () =>
      super.reverseSalesCommissionAfterRefund(orderId, refundId),
    );
  }

  override async previewBatch(dto: {
    merchantPromotionSourceId?: string;
    pickupStoreId?: string;
    periodStart: string;
    periodEnd: string;
  }) {
    await this.reconcileOutstandingSalesDebtsStrict(dto);
    return super.previewBatch(dto);
  }

  override async createBatch(dto: {
    merchantPromotionSourceId?: string;
    pickupStoreId?: string;
    periodStart: string;
    periodEnd: string;
    remark?: string;
  }) {
    await this.reconcileOutstandingSalesDebtsStrict(dto);
    return super.createBatch(dto);
  }

  /**
   * Public scheduler recovery for commissions that were created before a process crash prevented
   * the historical refund debt from being consumed. Only records that are not in an active batch
   * are mutated; entered/settled finance batches are never silently rewritten by this recovery.
   */
  async reconcileOutstandingSalesDebts(limit = DEBT_RECONCILE_BATCH_SIZE) {
    const candidates = await this.findOutstandingDebtCandidates(Math.max(1, limit));
    let reconciled = 0;
    let skipped = 0;
    let failed = 0;

    for (const candidate of candidates) {
      try {
        const offset = await this.withMerchantSalesLock(candidate.merchantId, () =>
          this.applyOutstandingDebtToRecord(candidate.recordId, candidate.merchantId),
        );
        if (offset > 0) reconciled += 1;
        else skipped += 1;
      } catch {
        failed += 1;
      }
    }

    return { total: candidates.length, reconciled, skipped, failed };
  }

  /**
   * Keeps the service-level recovery safe even if called directly outside ScheduleService. The SQL
   * filters missing commission rows before LIMIT, preventing the oldest already-processed orders
   * from starving later gaps once order volume exceeds the batch size.
   */
  override async generateMatureSalesCommissions(limit = DEBT_RECONCILE_BATCH_SIZE) {
    const cutoff = new Date(
      Date.now() - AFTERSALE_APPLY_DAYS * 24 * 60 * 60 * 1000,
    );
    const rows = await this.serializedPrisma.$queryRaw<Array<{
      id: bigint;
      userId: bigint;
      payAmount: number | null;
      sourceType: string;
      sourceCode: string;
    }>>`
      SELECT
        o.id AS id,
        o.user_id AS userId,
        o.pay_amount AS payAmount,
        o.source_type AS sourceType,
        o.source_code AS sourceCode
      FROM orders o
      WHERE o.status = 'completed'
        AND o.completed_at IS NOT NULL
        AND o.completed_at <= ${cutoff}
        AND o.source_type = 'merchant_referral'
        AND o.source_code IS NOT NULL
        AND COALESCE(o.pay_amount, 0) > 0
        AND NOT EXISTS (
          SELECT 1
          FROM merchant_commission_records r
          WHERE r.order_id = o.id
            AND r.source_type = 'sales_referral'
            AND r.deleted_at IS NULL
        )
      ORDER BY o.completed_at ASC, o.id ASC
      LIMIT ${Math.max(1, limit)}
    `;

    let generated = 0;
    let skipped = 0;
    let failed = 0;
    for (const row of rows) {
      try {
        await this.generateSalesCommission(
          row.id,
          row.userId,
          row.payAmount ?? 0,
          row.sourceType,
          row.sourceCode,
        );
        const record = await this.serializedPrisma.merchantCommissionRecord.findFirst({
          where: { orderId: row.id, sourceType: 'sales_referral', deletedAt: null },
          select: { id: true },
        });
        if (record) generated += 1;
        else skipped += 1;
      } catch {
        failed += 1;
      }
    }

    const debt = await this.reconcileOutstandingSalesDebts(Math.max(1, limit));
    return { total: rows.length, generated, skipped, failed, debt };
  }

  private async reconcileOutstandingSalesDebtsStrict(scope: BatchScope): Promise<void> {
    // A single commission can consume all or part of the current pending debt set. Re-read after
    // every page so records changed by the previous pass disappear from the candidate query.
    for (let round = 0; round < 20; round += 1) {
      const candidates = await this.findOutstandingDebtCandidates(
        DEBT_RECONCILE_BATCH_SIZE,
        scope,
      );
      if (candidates.length === 0) return;

      for (const candidate of candidates) {
        await this.withMerchantSalesLock(candidate.merchantId, () =>
          this.applyOutstandingDebtToRecord(candidate.recordId, candidate.merchantId),
        );
      }

      if (candidates.length < DEBT_RECONCILE_BATCH_SIZE) return;
    }

    throw new BadRequestException('待抵扣退款分佣负债过多，请稍后重试结算预览');
  }

  private async findOutstandingDebtCandidates(
    limit: number,
    scope?: BatchScope,
  ): Promise<DebtCandidate[]> {
    const merchantId = scope?.merchantPromotionSourceId
      ? BigInt(scope.merchantPromotionSourceId)
      : null;
    const pickupStoreId = scope?.pickupStoreId ? BigInt(scope.pickupStoreId) : null;
    const parsedStart = scope?.periodStart ? new Date(scope.periodStart) : null;
    const parsedEnd = scope?.periodEnd ? new Date(scope.periodEnd) : null;
    const periodStart = parsedStart && Number.isFinite(parsedStart.getTime()) ? parsedStart : null;
    const periodEnd = parsedEnd && Number.isFinite(parsedEnd.getTime()) ? parsedEnd : null;

    return this.serializedPrisma.$queryRaw<DebtCandidate[]>`
      SELECT
        r.id AS recordId,
        r.merchant_promotion_source_id AS merchantId
      FROM merchant_commission_records r
      LEFT JOIN merchant_settlement_items i
        ON i.commission_record_id = r.id
       AND i.status IN ('included', 'settled')
      WHERE r.deleted_at IS NULL
        AND r.source_type = 'sales_referral'
        AND r.status IN ('pending', 'confirmed')
        AND r.commission_amount > 0
        AND r.merchant_promotion_source_id IS NOT NULL
        AND i.id IS NULL
        AND (${merchantId} IS NULL OR r.merchant_promotion_source_id = ${merchantId})
        AND (${pickupStoreId} IS NULL OR r.pickup_store_id = ${pickupStoreId})
        AND (${periodStart} IS NULL OR r.occurred_at >= ${periodStart})
        AND (${periodEnd} IS NULL OR r.occurred_at <= ${periodEnd})
        AND EXISTS (
          SELECT 1
          FROM merchant_commission_records d
          WHERE d.merchant_promotion_source_id = r.merchant_promotion_source_id
            AND d.source_type = 'sales_referral_refund_debt'
            AND d.status = 'pending'
            AND d.commission_amount < 0
            AND d.deleted_at IS NULL
        )
      ORDER BY r.occurred_at ASC, r.id ASC
      LIMIT ${Math.max(1, limit)}
    `;
  }

  private async applyOutstandingDebtToRecord(
    recordId: bigint,
    merchantId: bigint,
  ): Promise<number> {
    return this.serializedPrisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM merchant_commission_records
        WHERE id = ${recordId}
        FOR UPDATE
      `;
      const record = await tx.merchantCommissionRecord.findUnique({ where: { id: recordId } });
      if (
        !record ||
        record.deletedAt ||
        record.merchantPromotionSourceId !== merchantId ||
        record.sourceType !== 'sales_referral' ||
        !['pending', 'confirmed'].includes(record.status) ||
        record.commissionAmount <= 0
      ) {
        return 0;
      }

      const activeItem = await tx.merchantSettlementItem.findUnique({
        where: { commissionRecordId: record.id },
      });
      if (activeItem && ['included', 'settled'].includes(activeItem.status)) {
        return 0;
      }

      await tx.$queryRaw`
        SELECT id FROM merchant_commission_records
        WHERE merchant_promotion_source_id = ${merchantId}
          AND source_type = 'sales_referral_refund_debt'
          AND status = 'pending'
          AND commission_amount < 0
          AND deleted_at IS NULL
        ORDER BY occurred_at ASC, id ASC
        FOR UPDATE
      `;
      const debts = await tx.merchantCommissionRecord.findMany({
        where: {
          merchantPromotionSourceId: merchantId,
          sourceType: 'sales_referral_refund_debt',
          status: 'pending',
          commissionAmount: { lt: 0 },
          deletedAt: null,
        },
        orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
      });
      if (debts.length === 0) return 0;

      const originalCommission = record.commissionAmount;
      let remainingCommission = originalCommission;
      const now = new Date();
      for (const debt of debts) {
        if (remainingCommission <= 0) break;
        const debtAmount = Math.abs(debt.commissionAmount);
        const offset = Math.min(remainingCommission, debtAmount);
        remainingCommission -= offset;
        const remainingDebt = debtAmount - offset;

        await tx.merchantCommissionRecord.update({
          where: { id: debt.id },
          data: remainingDebt === 0
            ? {
                commissionAmount: 0,
                status: 'settled',
                settledAt: now,
                remark: `${debt.remark || ''}；已由后续分佣自动抵扣完毕`,
              }
            : {
                commissionAmount: -remainingDebt,
                remark: `${debt.remark || ''}；已抵扣${offset}分，剩余${remainingDebt}分`,
              },
        });
      }

      const offsetTotal = originalCommission - remainingCommission;
      if (offsetTotal <= 0) return 0;

      await tx.merchantCommissionRecord.update({
        where: { id: record.id },
        data: remainingCommission === 0
          ? {
              commissionAmount: 0,
              status: 'cancelled',
              cancelledAt: now,
              remark: '本笔销售分佣已全部用于抵扣历史退款分佣负债',
            }
          : {
              commissionAmount: remainingCommission,
              remark: `历史退款分佣负债已抵扣${offsetTotal}分`,
            },
      });

      return offsetTotal;
    });
  }

  private async withMerchantSalesLock<T>(
    merchantId: bigint,
    action: () => Promise<T>,
  ): Promise<T> {
    const key = `merchant:settlement:sales:${merchantId.toString()}`;
    const token = `${process.pid}-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    const acquired = await this.serializedRedis.setNX(
      key,
      token,
      SALES_SETTLEMENT_LOCK_TTL_SECONDS,
    );
    if (!acquired) {
      throw new BadRequestException('该商家分佣或退款冲减正在处理中，请稍后重试');
    }

    try {
      return await action();
    } finally {
      await this.serializedRedis.releaseLockWithLua(key, token);
    }
  }
}
