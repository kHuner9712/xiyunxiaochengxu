import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AFTERSALE_APPLY_DAYS } from '@baby-mall/shared';
import { OrderStatus, Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { SerializedSalesMerchantSettlementService } from './serialized-sales-merchant-settlement.service';

const TEMPORAL_RULE_LOCK_TTL_SECONDS = 120;

const hasOwn = (value: object, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key);

function nullableBigInt(value: unknown): bigint | null {
  if (value === undefined || value === null || value === '') return null;
  return BigInt(String(value));
}

function nullableInt(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function nullableDate(value: unknown): Date | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = value instanceof Date ? value : new Date(String(value));
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function sameBigInt(left: bigint | null, right: bigint | null) {
  return left === right;
}

function sameDate(left: Date | null, right: Date | null) {
  return left?.getTime() === right?.getTime();
}

type RuleState = {
  name: string;
  ruleType: string;
  merchantPromotionSourceId: bigint | null;
  pickupStoreId: bigint | null;
  benefitPackageId: bigint | null;
  benefitPackageItemId: bigint | null;
  calculationType: string;
  commissionRate: number | null;
  commissionAmount: number | null;
  minCommissionAmount: number | null;
  maxCommissionAmount: number | null;
  effectiveStartAt: Date | null;
  effectiveEndAt: Date | null;
  status: number;
  priority: number;
  remark: string | null;
};

function computeCommission(rule: any, sourceAmount: number) {
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
 * Final merchant-settlement provider.
 *
 * Commission rules are financial facts. Mutating a rule in place would make delayed sales
 * commissions and recovery of missing service commissions use today's pricing for yesterday's
 * transaction. Financial edits therefore create a new visible rule version and soft-retire the
 * previous version at the edit timestamp. Historical matching intentionally includes archived
 * active versions whose lifetime covered the original business event.
 */
@Injectable()
export class TemporalRuleMerchantSettlementService extends SerializedSalesMerchantSettlementService {
  constructor(
    private readonly temporalPrisma: PrismaService,
    private readonly temporalRedis: RedisService,
  ) {
    super(temporalPrisma, temporalRedis);
  }

  override async createRule(dto: any) {
    const state = this.buildNewRuleState(dto);
    this.validateRuleState(state);
    return this.temporalPrisma.merchantCommissionRule.create({
      data: this.ruleCreateData(state),
    });
  }

  override async updateRule(id: string, dto: any) {
    const ruleId = BigInt(id);
    return this.temporalPrisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM merchant_commission_rules
        WHERE id = ${ruleId}
        FOR UPDATE
      `;
      const current = await tx.merchantCommissionRule.findUnique({ where: { id: ruleId } });
      if (!current || current.deletedAt) throw new NotFoundException('规则不存在');

      const next = this.mergeRuleState(current, dto);
      this.validateRuleState(next);

      if (!this.hasFinancialRuleChange(current, next)) {
        return tx.merchantCommissionRule.update({
          where: { id: ruleId },
          data: {
            name: next.name,
            remark: next.remark,
          },
        });
      }

      const changedAt = new Date();
      await tx.merchantCommissionRule.update({
        where: { id: ruleId },
        data: { deletedAt: changedAt },
      });

      return tx.merchantCommissionRule.create({
        data: this.ruleCreateData(next),
      });
    });
  }

  override async updateRuleStatus(id: string, status: number) {
    return this.updateRule(id, { status });
  }

  override async deleteRule(id: string) {
    const ruleId = BigInt(id);
    return this.temporalPrisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM merchant_commission_rules
        WHERE id = ${ruleId}
        FOR UPDATE
      `;
      const current = await tx.merchantCommissionRule.findUnique({ where: { id: ruleId } });
      if (!current || current.deletedAt) throw new NotFoundException('规则不存在');

      await tx.merchantCommissionRule.update({
        where: { id: ruleId },
        data: { deletedAt: new Date() },
      });
      return { success: true };
    });
  }

  override async generateSalesCommission(
    orderId: bigint | string,
    _userId: bigint | string,
    payAmount: number,
    sourceType: string,
    sourceCode: string,
  ): Promise<void> {
    if (sourceType !== 'merchant_referral' || !sourceCode) {
      return super.generateSalesCommission(orderId, _userId, payAmount, sourceType, sourceCode);
    }

    const normalizedOrderId = BigInt(orderId);
    const order = await this.temporalPrisma.order.findUnique({
      where: { id: normalizedOrderId },
      select: {
        id: true,
        userId: true,
        status: true,
        completedAt: true,
        paidAt: true,
        payAmount: true,
        pickupStoreId: true,
        sourceType: true,
        sourceCode: true,
      },
    });
    if (
      !order ||
      order.status !== OrderStatus.completed ||
      !order.completedAt ||
      order.sourceType !== 'merchant_referral' ||
      !order.sourceCode
    ) {
      return;
    }

    const completedAt = order.completedAt;
    const matureAt = new Date(
      completedAt.getTime() + AFTERSALE_APPLY_DAYS * 24 * 60 * 60 * 1000,
    );
    if (matureAt > new Date()) return;

    const refunded = await this.temporalPrisma.orderRefund.aggregate({
      where: { orderId: order.id, status: 'success' },
      _sum: { refundAmount: true },
    });
    const grossPaid = Math.max(0, order.payAmount ?? payAmount ?? 0);
    const refundedAmount = Math.min(
      grossPaid,
      Math.max(0, refunded._sum.refundAmount ?? 0),
    );
    const netPaidAmount = Math.max(0, grossPaid - refundedAmount);
    if (netPaidAmount <= 0) return;

    const merchant = await this.temporalPrisma.merchantPromotionSource.findFirst({
      where: { promotionCode: order.sourceCode, deletedAt: null },
      select: { id: true },
    });
    if (!merchant) return;

    const occurredAt = order.paidAt ?? completedAt;
    await this.withTemporalMerchantLock(merchant.id, async () => {
      const existing = await this.temporalPrisma.merchantCommissionRecord.findFirst({
        where: {
          orderId: order.id,
          sourceType: 'sales_referral',
          deletedAt: null,
        },
        select: { id: true },
      });
      if (existing) return;

      const rule = await this.matchSalesRuleAt(
        merchant.id,
        order.pickupStoreId,
        occurredAt,
      );
      if (!rule) return;

      const { amount, snapshot } = computeCommission(rule, netPaidAmount);
      if (amount <= 0) return;

      const dedupeKey = `sales_referral:order:${order.id}:merchant:${merchant.id}`;
      try {
        await this.temporalPrisma.merchantCommissionRecord.create({
          data: {
            ruleId: rule.id,
            merchantPromotionSourceId: merchant.id,
            pickupStoreId: order.pickupStoreId,
            userId: order.userId,
            orderId: order.id,
            sourceType: 'sales_referral',
            sourceAmount: netPaidAmount,
            commissionAmount: amount,
            calculationSnapshot: {
              ...snapshot,
              grossPaid,
              refundedAmount,
              salesOccurredAt: occurredAt.toISOString(),
              salesOccurredAtSource: order.paidAt ? 'paidAt' : 'completedAt_fallback',
              maturityCompletedAt: completedAt.toISOString(),
            },
            status: 'pending',
            dedupeKey,
            occurredAt,
          },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          return;
        }
        throw error;
      }
    });

    // Preserve the existing immediate debt-conservation intent without making the commission row
    // and Redis lock depend on an unbounded merchant-wide reconciliation. Any remaining gap is also
    // recovered hourly and is forced closed before finance preview/createBatch.
    await super.reconcileOutstandingSalesDebts(200);
  }

  override async generateServiceCommissionInTransaction(
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
    const existing = await tx.merchantCommissionRecord.findFirst({
      where: {
        verificationLogId: params.verificationLogId,
        sourceType: 'service_verification',
        deletedAt: null,
      },
      select: { id: true },
    });
    if (existing) return { created: false, reason: 'already_exists' };

    const item = await tx.benefitPackageItem.findFirst({
      where: { id: params.packageItemId },
      select: { id: true, originalValue: true },
    });
    if (!item) throw new Error(`服务结算失败：权益项不存在 itemId=${params.packageItemId}`);

    const sourceAmount = Math.max(0, item.originalValue ?? 0);
    const rule = await this.matchTemporalServiceRuleAt(tx, params, params.occurredAt);
    if (!rule) return { created: false, reason: 'no_rule' };

    const { amount, snapshot } = computeCommission(rule, sourceAmount);
    if (amount <= 0) return { created: false, reason: 'zero_amount' };

    const dedupeKey = `service_verification:verification_log:${params.verificationLogId}`;
    try {
      await tx.merchantCommissionRecord.create({
        data: {
          ruleId: rule.id,
          merchantPromotionSourceId: rule.merchantPromotionSourceId,
          pickupStoreId: rule.pickupStoreId ?? params.pickupStoreId ?? null,
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

  private buildNewRuleState(dto: any): RuleState {
    return this.normalizeRuleState({
      name: String(dto.name ?? '').trim(),
      ruleType: String(dto.ruleType ?? '').trim(),
      merchantPromotionSourceId: nullableBigInt(dto.merchantPromotionSourceId),
      pickupStoreId: nullableBigInt(dto.pickupStoreId),
      benefitPackageId: nullableBigInt(dto.benefitPackageId),
      benefitPackageItemId: nullableBigInt(dto.benefitPackageItemId),
      calculationType: String(dto.calculationType ?? '').trim(),
      commissionRate: nullableInt(dto.commissionRate),
      commissionAmount: nullableInt(dto.commissionAmount),
      minCommissionAmount: nullableInt(dto.minCommissionAmount),
      maxCommissionAmount: nullableInt(dto.maxCommissionAmount),
      effectiveStartAt: nullableDate(dto.effectiveStartAt),
      effectiveEndAt: nullableDate(dto.effectiveEndAt),
      status: dto.status == null ? 1 : Number(dto.status),
      priority: dto.priority == null ? 0 : Number(dto.priority),
      remark: dto.remark == null || dto.remark === '' ? null : String(dto.remark),
    });
  }

  private mergeRuleState(current: any, dto: any): RuleState {
    return this.normalizeRuleState({
      name: hasOwn(dto, 'name') ? String(dto.name ?? '').trim() : current.name,
      ruleType: hasOwn(dto, 'ruleType') ? String(dto.ruleType ?? '').trim() : current.ruleType,
      merchantPromotionSourceId: hasOwn(dto, 'merchantPromotionSourceId')
        ? nullableBigInt(dto.merchantPromotionSourceId)
        : current.merchantPromotionSourceId,
      pickupStoreId: hasOwn(dto, 'pickupStoreId')
        ? nullableBigInt(dto.pickupStoreId)
        : current.pickupStoreId,
      benefitPackageId: hasOwn(dto, 'benefitPackageId')
        ? nullableBigInt(dto.benefitPackageId)
        : current.benefitPackageId,
      benefitPackageItemId: hasOwn(dto, 'benefitPackageItemId')
        ? nullableBigInt(dto.benefitPackageItemId)
        : current.benefitPackageItemId,
      calculationType: hasOwn(dto, 'calculationType')
        ? String(dto.calculationType ?? '').trim()
        : current.calculationType,
      commissionRate: hasOwn(dto, 'commissionRate')
        ? nullableInt(dto.commissionRate)
        : current.commissionRate,
      commissionAmount: hasOwn(dto, 'commissionAmount')
        ? nullableInt(dto.commissionAmount)
        : current.commissionAmount,
      minCommissionAmount: hasOwn(dto, 'minCommissionAmount')
        ? nullableInt(dto.minCommissionAmount)
        : current.minCommissionAmount,
      maxCommissionAmount: hasOwn(dto, 'maxCommissionAmount')
        ? nullableInt(dto.maxCommissionAmount)
        : current.maxCommissionAmount,
      effectiveStartAt: hasOwn(dto, 'effectiveStartAt')
        ? nullableDate(dto.effectiveStartAt)
        : current.effectiveStartAt,
      effectiveEndAt: hasOwn(dto, 'effectiveEndAt')
        ? nullableDate(dto.effectiveEndAt)
        : current.effectiveEndAt,
      status: hasOwn(dto, 'status') ? Number(dto.status) : current.status,
      priority: hasOwn(dto, 'priority') ? Number(dto.priority) : current.priority,
      remark: hasOwn(dto, 'remark')
        ? dto.remark == null || dto.remark === '' ? null : String(dto.remark)
        : current.remark,
    });
  }

  private normalizeRuleState(state: RuleState): RuleState {
    if (state.ruleType === 'sales_referral') {
      return {
        ...state,
        benefitPackageId: null,
        benefitPackageItemId: null,
      };
    }
    return state;
  }

  private validateRuleState(state: RuleState) {
    if (!state.name) throw new BadRequestException('规则名称不能为空');
    if (!['sales_referral', 'service_verification'].includes(state.ruleType)) {
      throw new BadRequestException('规则类型无效');
    }
    if (!['percent', 'fixed_amount'].includes(state.calculationType)) {
      throw new BadRequestException('计算方式无效');
    }
    if (state.status !== 0 && state.status !== 1) {
      throw new BadRequestException('规则状态无效');
    }
    if (!Number.isInteger(state.priority) || state.priority < 0) {
      throw new BadRequestException('优先级必须为非负整数');
    }
    if (
      state.commissionRate != null &&
      (!Number.isInteger(state.commissionRate) || state.commissionRate < 0 || state.commissionRate > 10000)
    ) {
      throw new BadRequestException('分佣比例必须在0到10000基点之间');
    }
    for (const [label, amount] of [
      ['固定分佣金额', state.commissionAmount],
      ['最低分佣金额', state.minCommissionAmount],
      ['最高分佣金额', state.maxCommissionAmount],
    ] as const) {
      if (amount != null && (!Number.isInteger(amount) || amount < 0)) {
        throw new BadRequestException(`${label}必须为非负整数分`);
      }
    }
    if (
      state.minCommissionAmount != null &&
      state.maxCommissionAmount != null &&
      state.minCommissionAmount > state.maxCommissionAmount
    ) {
      throw new BadRequestException('最低分佣金额不能高于最高分佣金额');
    }
    if (
      state.effectiveStartAt &&
      state.effectiveEndAt &&
      state.effectiveStartAt >= state.effectiveEndAt
    ) {
      throw new BadRequestException('规则生效开始时间必须早于结束时间');
    }
  }

  private hasFinancialRuleChange(current: any, next: RuleState) {
    return (
      current.ruleType !== next.ruleType ||
      !sameBigInt(current.merchantPromotionSourceId, next.merchantPromotionSourceId) ||
      !sameBigInt(current.pickupStoreId, next.pickupStoreId) ||
      !sameBigInt(current.benefitPackageId, next.benefitPackageId) ||
      !sameBigInt(current.benefitPackageItemId, next.benefitPackageItemId) ||
      current.calculationType !== next.calculationType ||
      current.commissionRate !== next.commissionRate ||
      current.commissionAmount !== next.commissionAmount ||
      current.minCommissionAmount !== next.minCommissionAmount ||
      current.maxCommissionAmount !== next.maxCommissionAmount ||
      !sameDate(current.effectiveStartAt, next.effectiveStartAt) ||
      !sameDate(current.effectiveEndAt, next.effectiveEndAt) ||
      current.status !== next.status ||
      current.priority !== next.priority
    );
  }

  private ruleCreateData(state: RuleState) {
    return {
      name: state.name,
      ruleType: state.ruleType,
      merchantPromotionSourceId: state.merchantPromotionSourceId,
      pickupStoreId: state.pickupStoreId,
      benefitPackageId: state.benefitPackageId,
      benefitPackageItemId: state.benefitPackageItemId,
      calculationType: state.calculationType,
      commissionRate: state.commissionRate,
      commissionAmount: state.commissionAmount,
      minCommissionAmount: state.minCommissionAmount,
      maxCommissionAmount: state.maxCommissionAmount,
      effectiveStartAt: state.effectiveStartAt,
      effectiveEndAt: state.effectiveEndAt,
      status: state.status,
      priority: state.priority,
      remark: state.remark,
    };
  }

  private async matchSalesRuleAt(
    merchantId: bigint,
    pickupStoreId: bigint | null,
    occurredAt: Date,
  ) {
    const rules = await this.temporalPrisma.merchantCommissionRule.findMany({
      where: {
        ruleType: 'sales_referral',
        status: 1,
        createdAt: { lte: occurredAt },
      },
    });
    const candidates = rules.filter((rule) => {
      if (!this.ruleWasActiveAt(rule, occurredAt)) return false;
      if (
        rule.merchantPromotionSourceId != null &&
        rule.merchantPromotionSourceId !== merchantId
      ) return false;
      if (rule.pickupStoreId != null && rule.pickupStoreId !== pickupStoreId) return false;
      return true;
    });
    candidates.sort((left, right) =>
      right.priority - left.priority ||
      this.ruleSpecificity(right) - this.ruleSpecificity(left) ||
      Number(left.id - right.id),
    );
    return candidates[0] ?? null;
  }

  private async matchTemporalServiceRuleAt(
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
      if (!this.ruleWasActiveAt(rule, occurredAt)) return false;
      if (
        rule.benefitPackageItemId != null &&
        rule.benefitPackageItemId !== params.packageItemId
      ) return false;
      if (rule.benefitPackageId != null && rule.benefitPackageId !== params.packageId) return false;
      if (rule.pickupStoreId != null && rule.pickupStoreId !== (params.pickupStoreId ?? null)) return false;
      if (
        rule.merchantPromotionSourceId != null &&
        rule.merchantPromotionSourceId !== (params.merchantPromotionSourceId ?? null)
      ) return false;
      return true;
    });
    candidates.sort((left, right) =>
      right.priority - left.priority ||
      this.ruleSpecificity(right) - this.ruleSpecificity(left) ||
      Number(left.id - right.id),
    );
    return candidates[0] ?? null;
  }

  private ruleWasActiveAt(rule: any, occurredAt: Date) {
    if (rule.createdAt && occurredAt < rule.createdAt) return false;
    if (rule.deletedAt && occurredAt >= rule.deletedAt) return false;
    if (rule.effectiveStartAt && occurredAt < rule.effectiveStartAt) return false;
    if (rule.effectiveEndAt && occurredAt > rule.effectiveEndAt) return false;
    return true;
  }

  private ruleSpecificity(rule: any) {
    return [
      rule.merchantPromotionSourceId,
      rule.pickupStoreId,
      rule.benefitPackageId,
      rule.benefitPackageItemId,
    ].filter((value) => value != null).length;
  }

  private async withTemporalMerchantLock<T>(
    merchantId: bigint,
    action: () => Promise<T>,
  ): Promise<T> {
    const key = `merchant:settlement:sales:${merchantId.toString()}`;
    const token = `${process.pid}-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    const acquired = await this.temporalRedis.setNX(
      key,
      token,
      TEMPORAL_RULE_LOCK_TTL_SECONDS,
    );
    if (!acquired) {
      throw new BadRequestException('该商家分佣或退款冲减正在处理中，请稍后重试');
    }
    try {
      return await action();
    } finally {
      await this.temporalRedis.releaseLockWithLua(key, token);
    }
  }
}
