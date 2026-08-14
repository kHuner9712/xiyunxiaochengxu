import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { TemporalRuleMerchantSettlementService } from './temporal-rule-merchant-settlement.service';

function computeSnapshotCommission(rule: any, sourceAmount: number) {
  let amount = 0;
  const snapshot: Record<string, unknown> = {
    ruleId: rule.id.toString(),
    ruleName: rule.name,
    calculationType: rule.calculationType,
    commissionRate: rule.commissionRate ?? null,
    commissionAmount: rule.commissionAmount ?? null,
    minCommissionAmount: rule.minCommissionAmount ?? null,
    maxCommissionAmount: rule.maxCommissionAmount ?? null,
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

/**
 * Outermost merchant-settlement runtime provider.
 *
 * SnapshotAware recovery intentionally reconstructs a missing service commission from the
 * entitlement purchase snapshot. Its base implementation only searches currently-active rules,
 * though. This wrapper keeps the purchase-time value snapshot while selecting the rule version
 * that was active at the original verification time, including a later soft-retired version.
 */
@Injectable()
export class SnapshotTemporalRuleMerchantSettlementService extends TemporalRuleMerchantSettlementService {
  constructor(
    private readonly snapshotTemporalPrisma: PrismaService,
    snapshotTemporalRedis: RedisService,
  ) {
    super(snapshotTemporalPrisma, snapshotTemporalRedis);
  }

  override async updateRecordStatus(id: string, status: string, remark?: string) {
    if (status === 'settled') {
      throw new BadRequestException(
        '分佣已结算状态只能由结算批次在确认外部付款后生成，不能手工设置',
      );
    }
    return super.updateRecordStatus(id, status, remark);
  }

  override async generateSnapshotServiceCommissionInTransaction(
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

    const existing = await tx.merchantCommissionRecord.findFirst({
      where: {
        verificationLogId: params.verificationLogId,
        sourceType: 'service_verification',
        deletedAt: null,
      },
      select: { id: true },
    });
    if (existing) return { created: false, reason: 'already_exists' };

    const rule = await this.matchSnapshotTemporalRule(tx, params, params.occurredAt);
    if (!rule) return { created: false, reason: 'no_rule' };

    const { amount, snapshot } = computeSnapshotCommission(rule, params.sourceAmount);
    if (amount <= 0) return { created: false, reason: 'zero_amount' };

    const dedupeKey = `service_verification:verification_log:${params.verificationLogId}`;
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

  private async matchSnapshotTemporalRule(
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
        ruleType: 'service_verification',
        status: 1,
        createdAt: { lte: occurredAt },
      },
    });

    const candidates = rules.filter((rule) => {
      if (rule.deletedAt && occurredAt >= rule.deletedAt) return false;
      if (rule.effectiveStartAt && occurredAt < rule.effectiveStartAt) return false;
      if (rule.effectiveEndAt && occurredAt > rule.effectiveEndAt) return false;
      if (
        rule.benefitPackageItemId != null &&
        rule.benefitPackageItemId !== params.packageItemId
      ) return false;
      if (
        rule.benefitPackageId != null &&
        rule.benefitPackageId !== params.packageId
      ) return false;
      if (
        rule.pickupStoreId != null &&
        rule.pickupStoreId !== (params.pickupStoreId ?? null)
      ) return false;
      if (
        rule.merchantPromotionSourceId != null &&
        rule.merchantPromotionSourceId !== (params.merchantPromotionSourceId ?? null)
      ) return false;
      return true;
    });

    candidates.sort((left, right) =>
      right.priority - left.priority ||
      this.snapshotRuleSpecificity(right) - this.snapshotRuleSpecificity(left) ||
      Number(left.id - right.id),
    );
    return candidates[0] ?? null;
  }

  private snapshotRuleSpecificity(rule: any) {
    return [
      rule.merchantPromotionSourceId,
      rule.pickupStoreId,
      rule.benefitPackageId,
      rule.benefitPackageItemId,
    ].filter((value) => value != null).length;
  }
}
