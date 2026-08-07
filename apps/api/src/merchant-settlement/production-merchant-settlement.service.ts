import { Injectable, Logger } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { AFTERSALE_APPLY_DAYS } from '@baby-mall/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { MerchantSettlementService } from './merchant-settlement.service';

function computeProductionCommission(rule: any, sourceAmount: number) {
  let amount = 0;
  const snapshot: Record<string, unknown> = {
    ruleId: rule.id.toString(),
    ruleName: rule.name,
    calculationType: rule.calculationType,
    commissionRate: rule.commissionRate ?? null,
    commissionAmount: rule.commissionAmount ?? null,
    sourceAmount,
  };
  if (rule.calculationType === 'fixed_amount') {
    amount = rule.commissionAmount ?? 0;
    snapshot.formula = `fixed_amount: ${amount}`;
  } else if (rule.calculationType === 'percent') {
    const rate = rule.commissionRate ?? 0;
    amount = Math.floor((sourceAmount * rate) / 10000);
    snapshot.formula = `percent: sourceAmount(${sourceAmount}) * rate(${rate}) / 10000 = ${amount}`;
  }
  if (rule.minCommissionAmount != null && amount < rule.minCommissionAmount) {
    amount = rule.minCommissionAmount;
    snapshot.cappedBy = 'min';
  }
  if (rule.maxCommissionAmount != null && amount > rule.maxCommissionAmount) {
    amount = rule.maxCommissionAmount;
    snapshot.cappedBy = 'max';
  }
  snapshot.finalAmount = amount;
  return { amount, snapshot };
}

@Injectable()
export class ProductionMerchantSettlementService extends MerchantSettlementService {
  private readonly productionLogger = new Logger(ProductionMerchantSettlementService.name);

  constructor(private readonly productionPrisma: PrismaService) {
    super(productionPrisma);
  }

  override async generateSalesCommission(
    orderId: bigint | string,
    userId: bigint | string,
    payAmount: number,
    sourceType: string,
    sourceCode: string,
  ): Promise<void> {
    if (sourceType !== 'merchant_referral' || !sourceCode) return;

    const order = await this.productionPrisma.order.findUnique({
      where: { id: BigInt(orderId) },
      select: {
        id: true,
        status: true,
        completedAt: true,
        payAmount: true,
      },
    });
    if (!order || order.status !== OrderStatus.completed || !order.completedAt) {
      return;
    }

    const matureAt = new Date(
      order.completedAt.getTime() + AFTERSALE_APPLY_DAYS * 24 * 60 * 60 * 1000,
    );
    if (matureAt > new Date()) return;

    const successfulRefunds = await this.productionPrisma.orderRefund.aggregate({
      where: { orderId: order.id, status: 'success' },
      _sum: { refundAmount: true },
    });
    const grossPaid = Math.max(0, order.payAmount ?? payAmount ?? 0);
    const refundedAmount = Math.min(
      grossPaid,
      Math.max(0, successfulRefunds._sum.refundAmount ?? 0),
    );
    const netPaidAmount = Math.max(0, grossPaid - refundedAmount);
    if (netPaidAmount <= 0) return;

    await super.generateSalesCommission(
      orderId,
      userId,
      netPaidAmount,
      sourceType,
      sourceCode,
    );
    await this.applyOutstandingMerchantDebt(order.id);
  }

  override async generateServiceCommission(
    verificationLogId: bigint | string,
    entitlementId: bigint | string,
    packageItemId: bigint | string,
    packageId: bigint | string,
    pickupStoreId?: bigint | string | null,
    merchantPromotionSourceId?: bigint | string | null,
  ): Promise<void> {
    const verificationLog = await this.productionPrisma.userBenefitVerificationLog.findUnique({
      where: { id: BigInt(verificationLogId) },
      select: { createdAt: true },
    });
    const occurredAt = verificationLog?.createdAt ?? new Date();
    await this.productionPrisma.$transaction((tx) =>
      this.generateServiceCommissionInTransaction(tx, {
        verificationLogId: BigInt(verificationLogId),
        entitlementId: BigInt(entitlementId),
        packageItemId: BigInt(packageItemId),
        packageId: BigInt(packageId),
        pickupStoreId: pickupStoreId == null ? null : BigInt(pickupStoreId),
        merchantPromotionSourceId:
          merchantPromotionSourceId == null ? null : BigInt(merchantPromotionSourceId),
        occurredAt,
      }),
    );
  }

  async generateServiceCommissionInTransaction(
    tx: Prisma.TransactionClient,
    params: {
      verificationLogId: bigint;
      entitlementId: bigint;
      packageItemId: bigint;
      packageId: bigint;
      pickupStoreId?: bigint | null;
      merchantPromotionSourceId?: bigint | null;
      occurredAt: Date;
    },
  ): Promise<{ created: boolean; reason: string }> {
    const item = await tx.benefitPackageItem.findFirst({
      where: { id: params.packageItemId },
      select: { id: true, originalValue: true },
    });
    if (!item) throw new Error(`服务结算失败：权益项不存在 itemId=${params.packageItemId}`);
    const sourceAmount = Math.max(0, item.originalValue ?? 0);

    const rule = await this.matchServiceRuleAt(tx, params, params.occurredAt);
    if (!rule) return { created: false, reason: 'no_rule' };

    const { amount, snapshot } = computeProductionCommission(rule, sourceAmount);
    if (amount <= 0) return { created: false, reason: 'zero_amount' };

    const dedupeKey = `service_verification:verification_log:${params.verificationLogId}:rule:${rule.id}`;
    try {
      await tx.merchantCommissionRecord.create({
        data: {
          ruleId: rule.id,
          merchantPromotionSourceId: rule.merchantPromotionSourceId,
          pickupStoreId: rule.pickupStoreId,
          benefitPackageId: params.packageId,
          benefitPackageItemId: params.packageItemId,
          entitlementId: params.entitlementId,
          verificationLogId: params.verificationLogId,
          sourceType: 'service_verification',
          sourceAmount,
          commissionAmount: amount,
          calculationSnapshot: {
            ...snapshot,
            verificationOccurredAt: params.occurredAt.toISOString(),
          },
          status: 'pending',
          dedupeKey,
          occurredAt: params.occurredAt,
        },
      });
      return { created: true, reason: 'created' };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return { created: false, reason: 'already_exists' };
      }
      throw error;
    }
  }

  async reconcileMissingServiceCommissions(limit = 200) {
    const logs = await this.productionPrisma.$queryRaw<Array<{
      verificationLogId: bigint;
      entitlementId: bigint;
      packageId: bigint;
      packageItemId: bigint;
      createdAt: Date;
    }>>`
      SELECT
        l.id AS verificationLogId,
        l.entitlement_id AS entitlementId,
        l.package_id AS packageId,
        l.package_item_id AS packageItemId,
        l.created_at AS createdAt
      FROM user_benefit_verification_logs l
      WHERE l.action = 'verify'
        AND NOT EXISTS (
          SELECT 1
          FROM merchant_commission_records r
          WHERE r.verification_log_id = l.id
            AND r.source_type = 'service_verification'
            AND r.deleted_at IS NULL
        )
      ORDER BY l.created_at ASC
      LIMIT ${limit}
    `;

    let created = 0;
    let skipped = 0;
    let failed = 0;
    for (const log of logs) {
      try {
        const item = await this.productionPrisma.benefitPackageItem.findFirst({
          where: { id: log.packageItemId },
          select: { pickupStoreId: true, merchantPromotionSourceId: true },
        });
        if (!item) {
          failed += 1;
          this.productionLogger.error(
            `服务分佣补偿失败：核销日志${log.verificationLogId}对应权益项不存在`,
          );
          continue;
        }
        const result = await this.productionPrisma.$transaction((tx) =>
          this.generateServiceCommissionInTransaction(tx, {
            verificationLogId: log.verificationLogId,
            entitlementId: log.entitlementId,
            packageId: log.packageId,
            packageItemId: log.packageItemId,
            pickupStoreId: item.pickupStoreId,
            merchantPromotionSourceId: item.merchantPromotionSourceId,
            occurredAt: log.createdAt,
          }),
        );
        if (result.created) created += 1;
        else skipped += 1;
      } catch (error) {
        failed += 1;
        this.productionLogger.error(
          `服务分佣补偿失败: verificationLogId=${log.verificationLogId}, error=${(error as Error).message}`,
        );
      }
    }
    return { total: logs.length, created, skipped, failed };
  }

  async generateMatureSalesCommissions(limit = 200) {
    const cutoff = new Date(
      Date.now() - AFTERSALE_APPLY_DAYS * 24 * 60 * 60 * 1000,
    );
    const orders = await this.productionPrisma.order.findMany({
      where: {
        status: OrderStatus.completed,
        completedAt: { lte: cutoff },
        sourceType: 'merchant_referral',
        sourceCode: { not: null },
        payAmount: { gt: 0 },
      },
      select: {
        id: true,
        userId: true,
        payAmount: true,
        sourceType: true,
        sourceCode: true,
      },
      orderBy: { completedAt: 'asc' },
      take: limit,
    });

    let generated = 0;
    let skipped = 0;
    let failed = 0;
    for (const order of orders) {
      const existing = await this.productionPrisma.merchantCommissionRecord.findFirst({
        where: {
          orderId: order.id,
          sourceType: 'sales_referral',
          deletedAt: null,
        },
        select: { id: true },
      });
      if (existing) {
        skipped += 1;
        continue;
      }
      try {
        await this.generateSalesCommission(
          order.id,
          order.userId,
          order.payAmount || 0,
          order.sourceType,
          order.sourceCode || '',
        );
        const createdRecord = await this.productionPrisma.merchantCommissionRecord.findFirst({
          where: {
            orderId: order.id,
            sourceType: 'sales_referral',
            deletedAt: null,
          },
          select: { id: true },
        });
        if (createdRecord) generated += 1;
        else skipped += 1;
      } catch (error) {
        failed += 1;
        this.productionLogger.error(
          `成熟订单分佣生成失败: orderId=${order.id}, error=${(error as Error).message}`,
        );
      }
    }
    return { total: orders.length, generated, skipped, failed };
  }

  async reverseSalesCommissionAfterRefund(
    orderId: bigint | string,
    refundId: bigint | string,
  ) {
    const orderIdValue = BigInt(orderId);
    const order = await this.productionPrisma.order.findUnique({
      where: { id: orderIdValue },
      select: { id: true, payAmount: true },
    });
    if (!order || !order.payAmount || order.payAmount <= 0) {
      return { adjusted: 0, debtCreated: 0 };
    }

    const refunded = await this.productionPrisma.orderRefund.aggregate({
      where: { orderId: orderIdValue, status: 'success' },
      _sum: { refundAmount: true },
    });
    const totalRefunded = Math.min(order.payAmount, refunded._sum.refundAmount ?? 0);
    if (totalRefunded <= 0) return { adjusted: 0, debtCreated: 0 };
    const netOrderRevenue = Math.max(0, order.payAmount - totalRefunded);

    const records = await this.productionPrisma.merchantCommissionRecord.findMany({
      where: {
        orderId: orderIdValue,
        sourceType: 'sales_referral',
        deletedAt: null,
        status: { not: 'cancelled' },
      },
    });

    let adjusted = 0;
    let debtCreated = 0;
    for (const record of records) {
      const snapshot = (record.calculationSnapshot ?? {}) as Record<string, unknown>;
      const originalCommission = Number(snapshot.finalAmount ?? record.commissionAmount);
      const originalSource = Number(snapshot.sourceAmount ?? order.payAmount);
      if (!Number.isFinite(originalCommission) || originalCommission <= 0 || originalSource <= 0) {
        continue;
      }

      if (netOrderRevenue >= originalSource) continue;
      const targetSource = Math.max(0, netOrderRevenue);
      const targetCommission = Math.max(
        0,
        Math.floor((originalCommission * targetSource) / originalSource),
      );
      const currentPositiveCommission = Math.max(0, record.commissionAmount);
      const reversalAmount = Math.max(0, currentPositiveCommission - targetCommission);
      if (reversalAmount <= 0) continue;

      const item = await this.productionPrisma.merchantSettlementItem.findUnique({
        where: { commissionRecordId: record.id },
      });
      const batch = item
        ? await this.productionPrisma.merchantSettlementBatch.findUnique({
            where: { id: item.batchId },
          })
        : null;

      if (
        record.status === 'settled' ||
        item?.status === 'settled' ||
        batch?.status === 'paid'
      ) {
        const dedupeKey = `sales_referral_refund_debt:refund:${refundId}:record:${record.id}`;
        try {
          await this.productionPrisma.merchantCommissionRecord.create({
            data: {
              ruleId: record.ruleId,
              merchantPromotionSourceId: record.merchantPromotionSourceId,
              userId: record.userId,
              orderId: record.orderId,
              sourceType: 'sales_referral_refund_debt',
              sourceAmount: -Math.max(0, originalSource - targetSource),
              commissionAmount: -reversalAmount,
              calculationSnapshot: {
                originalRecordId: record.id.toString(),
                refundId: String(refundId),
                cumulativeRefunded: totalRefunded,
                targetSource,
                reversalAmount,
              },
              status: 'pending',
              dedupeKey,
              occurredAt: new Date(),
              remark: '已结算销售分佣发生退款，待从后续分佣自动抵扣',
            },
          });
          debtCreated += 1;
        } catch (error) {
          if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) {
            throw error;
          }
        }
        continue;
      }

      await this.productionPrisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM merchant_commission_records WHERE id = ${record.id} FOR UPDATE`;
        const lockedRecord = await tx.merchantCommissionRecord.findUnique({ where: { id: record.id } });
        if (!lockedRecord || lockedRecord.status === 'settled' || lockedRecord.status === 'cancelled') return;

        const lockedItem = await tx.merchantSettlementItem.findUnique({
          where: { commissionRecordId: record.id },
        });
        const lockedBatch = lockedItem
          ? await tx.merchantSettlementBatch.findUnique({ where: { id: lockedItem.batchId } })
          : null;
        if (lockedBatch?.status === 'paid' || lockedItem?.status === 'settled') {
          throw new Error('分佣批次已付款，需转入后续抵扣');
        }

        await tx.merchantCommissionRecord.update({
          where: { id: record.id },
          data: {
            sourceAmount: targetSource,
            commissionAmount: targetCommission,
            ...(targetCommission === 0
              ? { status: 'cancelled', cancelledAt: new Date() }
              : {}),
            remark: `订单退款后自动冲减分佣，累计退款${totalRefunded}分，剩余有效成交${targetSource}分`,
          },
        });

        if (lockedItem && lockedBatch && lockedItem.status === 'included') {
          const commissionDelta = lockedItem.amount - targetCommission;
          const sourceDelta = Math.max(0, record.sourceAmount - targetSource);
          await tx.merchantSettlementItem.update({
            where: { id: lockedItem.id },
            data: {
              amount: targetCommission,
              ...(targetCommission === 0 ? { status: 'removed' } : {}),
            },
          });
          await tx.merchantSettlementBatch.update({
            where: { id: lockedBatch.id },
            data: {
              totalCommissionAmount: { decrement: commissionDelta },
              totalSourceAmount: { decrement: sourceDelta },
              ...(targetCommission === 0
                ? { recordCount: { decrement: 1 } }
                : {}),
            },
          });
        }
        adjusted += 1;
      });
    }

    return { adjusted, debtCreated };
  }

  private async matchServiceRuleAt(
    tx: Prisma.TransactionClient,
    params: {
      packageItemId: bigint;
      packageId: bigint;
      pickupStoreId?: bigint | null;
      merchantPromotionSourceId?: bigint | null;
    },
    occurredAt: Date,
  ) {
    const rules = await tx.merchantCommissionRule.findMany({
      where: {
        deletedAt: null,
        ruleType: 'service_verification',
        status: 1,
        createdAt: { lte: occurredAt },
      },
    });
    const effective = rules.filter((rule) => {
      if (rule.effectiveStartAt && occurredAt < rule.effectiveStartAt) return false;
      if (rule.effectiveEndAt && occurredAt > rule.effectiveEndAt) return false;
      return true;
    });

    const itemId = params.packageItemId.toString();
    const packageId = params.packageId.toString();
    const storeId = params.pickupStoreId?.toString();
    const merchantId = params.merchantPromotionSourceId?.toString();

    let candidates = effective.filter(
      (rule) => rule.benefitPackageItemId?.toString() === itemId,
    );
    if (candidates.length === 0) {
      candidates = effective.filter(
        (rule) =>
          rule.benefitPackageId?.toString() === packageId &&
          rule.benefitPackageItemId === null,
      );
    }
    if (candidates.length === 0 && storeId) {
      candidates = effective.filter(
        (rule) =>
          rule.pickupStoreId?.toString() === storeId &&
          rule.benefitPackageId === null &&
          rule.benefitPackageItemId === null,
      );
    }
    if (candidates.length === 0 && merchantId) {
      candidates = effective.filter(
        (rule) =>
          rule.merchantPromotionSourceId?.toString() === merchantId &&
          rule.benefitPackageId === null &&
          rule.benefitPackageItemId === null &&
          rule.pickupStoreId === null,
      );
    }
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b.priority - a.priority || Number(a.id - b.id));
    return candidates[0];
  }

  private async applyOutstandingMerchantDebt(orderId: bigint) {
    const newRecord = await this.productionPrisma.merchantCommissionRecord.findFirst({
      where: {
        orderId,
        sourceType: 'sales_referral',
        status: 'pending',
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!newRecord?.merchantPromotionSourceId || newRecord.commissionAmount <= 0) return;

    const debts = await this.productionPrisma.merchantCommissionRecord.findMany({
      where: {
        merchantPromotionSourceId: newRecord.merchantPromotionSourceId,
        sourceType: 'sales_referral_refund_debt',
        status: 'pending',
        commissionAmount: { lt: 0 },
        deletedAt: null,
      },
      orderBy: { occurredAt: 'asc' },
    });
    if (debts.length === 0) return;

    await this.productionPrisma.$transaction(async (tx) => {
      let remainingCommission = newRecord.commissionAmount;
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
                settledAt: new Date(),
                remark: `${debt.remark || ''}；已由后续分佣自动抵扣完毕`,
              }
            : {
                commissionAmount: -remainingDebt,
                remark: `${debt.remark || ''}；已抵扣${offset}分，剩余${remainingDebt}分`,
              },
        });
      }

      await tx.merchantCommissionRecord.update({
        where: { id: newRecord.id },
        data: remainingCommission === 0
          ? {
              commissionAmount: 0,
              status: 'cancelled',
              cancelledAt: new Date(),
              remark: '本笔销售分佣已全部用于抵扣历史退款分佣负债',
            }
          : {
              commissionAmount: remainingCommission,
              remark: remainingCommission < newRecord.commissionAmount
                ? `历史退款分佣负债已抵扣${newRecord.commissionAmount - remainingCommission}分`
                : newRecord.remark,
            },
      });
    });
  }
}
