import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { StateSafeProductionMerchantSettlementService } from './state-safe-production-merchant-settlement.service';

const ENTITLEMENT_SNAPSHOT_EVENT = 'benefit_entitlement_snapshot';
const ENTITLEMENT_BIZ_TYPE = 'benefit_entitlement';

function computeCommission(rule: any, sourceAmount: number) {
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
export class SnapshotAwareStateSafeMerchantSettlementService extends StateSafeProductionMerchantSettlementService {
  private readonly snapshotLogger = new Logger(SnapshotAwareStateSafeMerchantSettlementService.name);

  constructor(private readonly snapshotPrisma: PrismaService) {
    super(snapshotPrisma);
  }

  async generateSnapshotServiceCommissionInTransaction(
    tx: Prisma.TransactionClient,
    params: {
      verificationLogId: bigint;
      entitlementId: bigint;
      packageItemId: bigint;
      packageId: bigint;
      pickupStoreId?: bigint | null;
      merchantPromotionSourceId?: bigint | null;
      sourceAmount: number;
      occurredAt: Date;
    },
  ): Promise<{ created: boolean; reason: string }> {
    if (!Number.isSafeInteger(params.sourceAmount) || params.sourceAmount < 0) {
      throw new Error(`服务结算失败：权益快照价值无效 sourceAmount=${params.sourceAmount}`);
    }

    const rule = await this.matchSnapshotServiceRule(tx, params, params.occurredAt);
    if (!rule) return { created: false, reason: 'no_rule' };
    const { amount, snapshot } = computeCommission(rule, params.sourceAmount);
    if (amount <= 0) return { created: false, reason: 'zero_amount' };

    const dedupeKey = `service_verification:verification_log:${params.verificationLogId}:rule:${rule.id}`;
    try {
      await tx.merchantCommissionRecord.create({
        data: {
          ruleId: rule.id,
          merchantPromotionSourceId:
            rule.merchantPromotionSourceId ?? params.merchantPromotionSourceId ?? null,
          pickupStoreId: rule.pickupStoreId ?? params.pickupStoreId ?? null,
          benefitPackageId: params.packageId,
          benefitPackageItemId: params.packageItemId,
          entitlementId: params.entitlementId,
          verificationLogId: params.verificationLogId,
          sourceType: 'service_verification',
          sourceAmount: params.sourceAmount,
          commissionAmount: amount,
          calculationSnapshot: {
            ...snapshot,
            benefitValueSource: 'purchase_snapshot',
            snapshotMerchantPromotionSourceId:
              params.merchantPromotionSourceId?.toString() ?? null,
            snapshotPickupStoreId: params.pickupStoreId?.toString() ?? null,
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

  override async reconcileMissingServiceCommissions(limit = 200) {
    const logs = await this.snapshotPrisma.$queryRaw<Array<{
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
        const snapshotEvent = await this.snapshotPrisma.businessEvent.findFirst({
          where: {
            eventType: ENTITLEMENT_SNAPSHOT_EVENT,
            bizType: ENTITLEMENT_BIZ_TYPE,
            bizId: log.entitlementId.toString(),
          },
          orderBy: { createdAt: 'asc' },
        });
        const payload = (snapshotEvent?.payload ?? {}) as Record<string, any>;
        const snapshotItem = payload.item && typeof payload.item === 'object'
          ? payload.item as Record<string, any>
          : null;
        const currentItem = snapshotItem
          ? null
          : await this.snapshotPrisma.benefitPackageItem.findFirst({
              where: { id: log.packageItemId },
              select: {
                originalValue: true,
                pickupStoreId: true,
                merchantPromotionSourceId: true,
              },
            });
        if (!snapshotItem && !currentItem) {
          failed += 1;
          this.snapshotLogger.error(
            `服务分佣补偿失败：核销日志${log.verificationLogId}对应权益项及快照均不存在`,
          );
          continue;
        }

        const sourceAmount = Number(snapshotItem?.originalValue ?? currentItem?.originalValue ?? 0);
        const pickupStoreId = snapshotItem?.pickupStoreId != null
          ? BigInt(snapshotItem.pickupStoreId)
          : currentItem?.pickupStoreId ?? null;
        const merchantPromotionSourceId = snapshotItem?.merchantPromotionSourceId != null
          ? BigInt(snapshotItem.merchantPromotionSourceId)
          : currentItem?.merchantPromotionSourceId ?? null;

        const result = await this.snapshotPrisma.$transaction((tx) =>
          this.generateSnapshotServiceCommissionInTransaction(tx, {
            verificationLogId: log.verificationLogId,
            entitlementId: log.entitlementId,
            packageId: log.packageId,
            packageItemId: log.packageItemId,
            pickupStoreId,
            merchantPromotionSourceId,
            sourceAmount,
            occurredAt: log.createdAt,
          }),
        );
        if (result.created) created += 1;
        else skipped += 1;
      } catch (error) {
        failed += 1;
        this.snapshotLogger.error(
          `服务分佣补偿失败: verificationLogId=${log.verificationLogId}, error=${(error as Error).message}`,
        );
      }
    }
    return { total: logs.length, created, skipped, failed };
  }

  private async matchSnapshotServiceRule(
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
}
