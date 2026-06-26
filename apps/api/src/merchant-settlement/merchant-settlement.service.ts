import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { paginate } from '@baby-mall/shared';

function cleanId(v: any): bigint | null {
  if (v === undefined || v === null || v === '') return null;
  return BigInt(v);
}

function toInt(v: any): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function parseDate(v?: string): Date | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  return isNaN(d.getTime()) ? undefined : d;
}

// 生成结算单号：SETTLE + YYYYMMDD + 4 位序列
async function generateSettlementNo(prisma: PrismaService): Promise<string> {
  const today = new Date();
  const ymd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  const prefix = `SETTLE${ymd}`;
  // 查询当天已有批次数 + 1
  const count = await prisma.merchantSettlementBatch.count({
    where: { settlementNo: { startsWith: prefix } },
  });
  const seq = String(count + 1).padStart(4, '0');
  return `${prefix}${seq}`;
}

// 计算分佣金额
function computeCommission(
  rule: any,
  sourceAmount: number,
): { amount: number; snapshot: any } {
  let amount = 0;
  const snapshot: any = {
    ruleId: rule.id,
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

  // 应用 min / max 限制
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
export class MerchantSettlementService {
  private readonly logger = new Logger(MerchantSettlementService.name);

  constructor(private prisma: PrismaService) {}

  // ============ 规则管理 ============

  async findRules(query: {
    page: number;
    pageSize: number;
    keyword?: string;
    ruleType?: string;
    merchantPromotionSourceId?: string;
    pickupStoreId?: string;
    benefitPackageId?: string;
    status?: number;
  }) {
    const { page, pageSize } = query;
    const where: Prisma.MerchantCommissionRuleWhereInput = { deletedAt: null };
    if (query.keyword) where.name = { contains: query.keyword };
    if (query.ruleType) where.ruleType = query.ruleType;
    if (query.merchantPromotionSourceId)
      where.merchantPromotionSourceId = BigInt(query.merchantPromotionSourceId);
    if (query.pickupStoreId) where.pickupStoreId = BigInt(query.pickupStoreId);
    if (query.benefitPackageId)
      where.benefitPackageId = BigInt(query.benefitPackageId);
    if (query.status !== undefined) where.status = query.status;

    const [list, total] = await Promise.all([
      this.prisma.merchantCommissionRule.findMany({
        where,
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.merchantCommissionRule.count({ where }),
    ]);
    return paginate(list, total, page, pageSize);
  }

  async findRuleById(id: string) {
    const rule = await this.prisma.merchantCommissionRule.findFirst({
      where: { id: BigInt(id), deletedAt: null },
    });
    if (!rule) throw new NotFoundException('规则不存在');
    return rule;
  }

  async createRule(dto: any) {
    return this.prisma.merchantCommissionRule.create({
      data: {
        name: dto.name,
        ruleType: dto.ruleType,
        merchantPromotionSourceId: cleanId(dto.merchantPromotionSourceId),
        pickupStoreId: cleanId(dto.pickupStoreId),
        benefitPackageId: cleanId(dto.benefitPackageId),
        benefitPackageItemId: cleanId(dto.benefitPackageItemId),
        calculationType: dto.calculationType,
        commissionRate: toInt(dto.commissionRate),
        commissionAmount: toInt(dto.commissionAmount),
        minCommissionAmount: toInt(dto.minCommissionAmount),
        maxCommissionAmount: toInt(dto.maxCommissionAmount),
        effectiveStartAt: parseDate(dto.effectiveStartAt),
        effectiveEndAt: parseDate(dto.effectiveEndAt),
        status: dto.status ?? 1,
        priority: dto.priority ?? 0,
        remark: dto.remark ?? null,
      },
    });
  }

  async updateRule(id: string, dto: any) {
    await this.findRuleById(id);
    return this.prisma.merchantCommissionRule.update({
      where: { id: BigInt(id) },
      data: {
        name: dto.name,
        ruleType: dto.ruleType,
        merchantPromotionSourceId: cleanId(dto.merchantPromotionSourceId),
        pickupStoreId: cleanId(dto.pickupStoreId),
        benefitPackageId: cleanId(dto.benefitPackageId),
        benefitPackageItemId: cleanId(dto.benefitPackageItemId),
        calculationType: dto.calculationType,
        commissionRate: toInt(dto.commissionRate),
        commissionAmount: toInt(dto.commissionAmount),
        minCommissionAmount: toInt(dto.minCommissionAmount),
        maxCommissionAmount: toInt(dto.maxCommissionAmount),
        effectiveStartAt: parseDate(dto.effectiveStartAt),
        effectiveEndAt: parseDate(dto.effectiveEndAt),
        status: dto.status,
        priority: dto.priority ?? 0,
        remark: dto.remark ?? null,
      },
    });
  }

  async updateRuleStatus(id: string, status: number) {
    await this.findRuleById(id);
    return this.prisma.merchantCommissionRule.update({
      where: { id: BigInt(id) },
      data: { status },
    });
  }

  async deleteRule(id: string) {
    await this.findRuleById(id);
    await this.prisma.merchantCommissionRule.update({
      where: { id: BigInt(id) },
      data: { deletedAt: new Date() },
    });
    return { success: true };
  }

  // ============ 分佣明细 ============

  async findRecords(query: {
    page: number;
    pageSize: number;
    sourceType?: string;
    merchantPromotionSourceId?: string;
    pickupStoreId?: string;
    status?: string;
    orderId?: string;
    verifyCode?: string;
    occurredFrom?: string;
    occurredTo?: string;
  }) {
    const { page, pageSize } = query;
    const where: Prisma.MerchantCommissionRecordWhereInput = { deletedAt: null };
    if (query.sourceType) where.sourceType = query.sourceType;
    if (query.merchantPromotionSourceId)
      where.merchantPromotionSourceId = BigInt(query.merchantPromotionSourceId);
    if (query.pickupStoreId) where.pickupStoreId = BigInt(query.pickupStoreId);
    if (query.status) where.status = query.status;
    if (query.orderId) where.orderId = BigInt(query.orderId);
    if (query.verifyCode) {
      // 通过 verificationLogId 反查不到 verifyCode 直接，这里通过 entitlement 关联
      // 简化：用 verification_logs 表反查 entitlementId 列表
      const logs = await this.prisma.userBenefitVerificationLog.findMany({
        where: { verifyCode: { contains: query.verifyCode.toUpperCase() } },
        select: { id: true },
        take: 200,
      });
      if (logs.length === 0) return paginate([], 0, page, pageSize);
      where.verificationLogId = { in: logs.map((l) => l.id) };
    }
    if (query.occurredFrom || query.occurredTo) {
      where.occurredAt = {};
      if (query.occurredFrom) where.occurredAt.gte = parseDate(query.occurredFrom);
      if (query.occurredTo) where.occurredAt.lte = parseDate(query.occurredTo);
    }

    const [list, total] = await Promise.all([
      this.prisma.merchantCommissionRecord.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.merchantCommissionRecord.count({ where }),
    ]);

    // 补充商家名/门店名/订单号/核销码
    const enriched = await Promise.all(
      list.map(async (r) => {
        const [merchant, store, order, log] = await Promise.all([
          r.merchantPromotionSourceId
            ? this.prisma.merchantPromotionSource.findFirst({
                where: { id: r.merchantPromotionSourceId },
                select: { id: true, name: true, promotionCode: true },
              })
            : null,
          r.pickupStoreId
            ? this.prisma.pickupStore.findFirst({
                where: { id: r.pickupStoreId },
                select: { id: true, name: true },
              })
            : null,
          r.orderId
            ? this.prisma.order.findFirst({
                where: { id: r.orderId },
                select: { id: true, orderNo: true },
              })
            : null,
          r.verificationLogId
            ? this.prisma.userBenefitVerificationLog.findFirst({
                where: { id: r.verificationLogId },
                select: { id: true, verifyCode: true },
              })
            : null,
        ]);
        return {
          ...r,
          merchantName: merchant?.name ?? null,
          merchantCode: merchant?.promotionCode ?? null,
          storeName: store?.name ?? null,
          orderNo: order?.orderNo ?? null,
          verifyCode: log?.verifyCode ?? null,
        };
      }),
    );
    return paginate(enriched, total, page, pageSize);
  }

  async getRecordsStats() {
    const records = await this.prisma.merchantCommissionRecord.findMany({
      where: { deletedAt: null },
      select: { status: true, sourceAmount: true, commissionAmount: true },
    });
    const stats = {
      total: records.length,
      pending: 0,
      confirmed: 0,
      settled: 0,
      cancelled: 0,
      pendingAmount: 0,
      confirmedAmount: 0,
      settledAmount: 0,
      cancelledAmount: 0,
      totalSourceAmount: 0,
      totalCommissionAmount: 0,
    };
    for (const r of records) {
      stats.totalSourceAmount += r.sourceAmount;
      stats.totalCommissionAmount += r.commissionAmount;
      if (r.status === 'pending') {
        stats.pending++;
        stats.pendingAmount += r.commissionAmount;
      } else if (r.status === 'confirmed') {
        stats.confirmed++;
        stats.confirmedAmount += r.commissionAmount;
      } else if (r.status === 'settled') {
        stats.settled++;
        stats.settledAmount += r.commissionAmount;
      } else if (r.status === 'cancelled') {
        stats.cancelled++;
        stats.cancelledAmount += r.commissionAmount;
      }
    }
    return stats;
  }

  async updateRecordStatus(id: string, status: string, remark?: string) {
    const record = await this.prisma.merchantCommissionRecord.findFirst({
      where: { id: BigInt(id), deletedAt: null },
    });
    if (!record) throw new NotFoundException('记录不存在');
    const now = new Date();
    const data: any = { status };
    if (status === 'confirmed') data.confirmedAt = now;
    if (status === 'settled') data.settledAt = now;
    if (status === 'cancelled') data.cancelledAt = now;
    if (remark !== undefined) data.remark = remark;
    return this.prisma.merchantCommissionRecord.update({
      where: { id: BigInt(id) },
      data,
    });
  }

  // ============ 结算批次 ============

  async findBatches(query: {
    page: number;
    pageSize: number;
    merchantPromotionSourceId?: string;
    pickupStoreId?: string;
    status?: string;
    periodStart?: string;
    periodEnd?: string;
  }) {
    const { page, pageSize } = query;
    const where: Prisma.MerchantSettlementBatchWhereInput = { deletedAt: null };
    if (query.merchantPromotionSourceId)
      where.merchantPromotionSourceId = BigInt(query.merchantPromotionSourceId);
    if (query.pickupStoreId) where.pickupStoreId = BigInt(query.pickupStoreId);
    if (query.status) where.status = query.status;
    if (query.periodStart)
      where.periodStart = { gte: parseDate(query.periodStart) };
    if (query.periodEnd) where.periodEnd = { lte: parseDate(query.periodEnd) };

    const [list, total] = await Promise.all([
      this.prisma.merchantSettlementBatch.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.merchantSettlementBatch.count({ where }),
    ]);

    const enriched = await Promise.all(
      list.map(async (b) => {
        const [merchant, store] = await Promise.all([
          b.merchantPromotionSourceId
            ? this.prisma.merchantPromotionSource.findFirst({
                where: { id: b.merchantPromotionSourceId },
                select: { id: true, name: true, promotionCode: true },
              })
            : null,
          b.pickupStoreId
            ? this.prisma.pickupStore.findFirst({
                where: { id: b.pickupStoreId },
                select: { id: true, name: true },
              })
            : null,
        ]);
        return {
          ...b,
          merchantName: merchant?.name ?? null,
          merchantCode: merchant?.promotionCode ?? null,
          storeName: store?.name ?? null,
        };
      }),
    );
    return paginate(enriched, total, page, pageSize);
  }

  async findBatchById(id: string) {
    const batch = await this.prisma.merchantSettlementBatch.findFirst({
      where: { id: BigInt(id), deletedAt: null },
    });
    if (!batch) throw new NotFoundException('结算批次不存在');

    const items = await this.prisma.merchantSettlementItem.findMany({
      where: { batchId: BigInt(id) },
      orderBy: { createdAt: 'desc' },
    });

    const enrichedItems = await Promise.all(
      items.map(async (it) => {
        const record = await this.prisma.merchantCommissionRecord.findFirst({
          where: { id: it.commissionRecordId },
        });
        const [merchant, store, order, log] = await Promise.all([
          record?.merchantPromotionSourceId
            ? this.prisma.merchantPromotionSource.findFirst({
                where: { id: record.merchantPromotionSourceId },
                select: { id: true, name: true, promotionCode: true },
              })
            : null,
          record?.pickupStoreId
            ? this.prisma.pickupStore.findFirst({
                where: { id: record.pickupStoreId },
                select: { id: true, name: true },
              })
            : null,
          record?.orderId
            ? this.prisma.order.findFirst({
                where: { id: record.orderId },
                select: { id: true, orderNo: true },
              })
            : null,
          record?.verificationLogId
            ? this.prisma.userBenefitVerificationLog.findFirst({
                where: { id: record.verificationLogId },
                select: { id: true, verifyCode: true },
              })
            : null,
        ]);
        return {
          ...it,
          record: record
            ? {
                ...record,
                merchantName: merchant?.name ?? null,
                merchantCode: merchant?.promotionCode ?? null,
                storeName: store?.name ?? null,
                orderNo: order?.orderNo ?? null,
                verifyCode: log?.verifyCode ?? null,
              }
            : null,
        };
      }),
    );

    const [merchant, store] = await Promise.all([
      batch.merchantPromotionSourceId
        ? this.prisma.merchantPromotionSource.findFirst({
            where: { id: batch.merchantPromotionSourceId },
            select: { id: true, name: true, promotionCode: true },
          })
        : null,
      batch.pickupStoreId
        ? this.prisma.pickupStore.findFirst({
            where: { id: batch.pickupStoreId },
            select: { id: true, name: true },
          })
        : null,
    ]);

    return {
      ...batch,
      merchantName: merchant?.name ?? null,
      merchantCode: merchant?.promotionCode ?? null,
      storeName: store?.name ?? null,
      items: enrichedItems,
    };
  }

  // 预览可结算记录（不创建批次）
  async previewBatch(dto: {
    merchantPromotionSourceId?: string;
    pickupStoreId?: string;
    periodStart: string;
    periodEnd: string;
  }) {
    const where = await this.buildBatchRecordWhere(dto);
    const records = await this.prisma.merchantCommissionRecord.findMany({
      where,
      select: {
        id: true,
        sourceAmount: true,
        commissionAmount: true,
        sourceType: true,
        occurredAt: true,
      },
    });
    return {
      recordCount: records.length,
      totalSourceAmount: records.reduce((s, r) => s + r.sourceAmount, 0),
      totalCommissionAmount: records.reduce((s, r) => s + r.commissionAmount, 0),
    };
  }

  private async buildBatchRecordWhere(dto: {
    merchantPromotionSourceId?: string;
    pickupStoreId?: string;
    periodStart: string;
    periodEnd: string;
  }): Promise<Prisma.MerchantCommissionRecordWhereInput> {
    const where: Prisma.MerchantCommissionRecordWhereInput = {
      deletedAt: null,
      status: { in: ['pending', 'confirmed'] },
      occurredAt: {
        gte: parseDate(dto.periodStart),
        lte: parseDate(dto.periodEnd),
      },
      commissionAmount: { gt: 0 },
    };
    if (dto.merchantPromotionSourceId)
      where.merchantPromotionSourceId = BigInt(dto.merchantPromotionSourceId);
    if (dto.pickupStoreId) where.pickupStoreId = BigInt(dto.pickupStoreId);

    // 排除已被未取消 batch 包含的记录
    const includedItems = await this.prisma.merchantSettlementItem.findMany({
      where: { status: { in: ['included', 'settled'] } },
      select: { commissionRecordId: true },
    });
    if (includedItems.length > 0) {
      const includedIds = includedItems.map((i) => i.commissionRecordId);
      where.id = { notIn: includedIds };
    }
    return where;
  }

  async createBatch(dto: {
    merchantPromotionSourceId?: string;
    pickupStoreId?: string;
    periodStart: string;
    periodEnd: string;
    remark?: string;
  }) {
    const periodStart = parseDate(dto.periodStart);
    const periodEnd = parseDate(dto.periodEnd);
    if (!periodStart || !periodEnd)
      throw new BadRequestException('周期起止时间不能为空');
    if (periodStart >= periodEnd)
      throw new BadRequestException('周期开始时间必须早于结束时间');

    const where = await this.buildBatchRecordWhere({
      ...dto,
      periodStart: dto.periodStart,
      periodEnd: dto.periodEnd,
    });
    const records = await this.prisma.merchantCommissionRecord.findMany({
      where,
    });

    if (records.length === 0)
      throw new BadRequestException('所选范围内无可结算记录');

    const settlementNo = await generateSettlementNo(this.prisma);
    const totalSourceAmount = records.reduce((s, r) => s + r.sourceAmount, 0);
    const totalCommissionAmount = records.reduce(
      (s, r) => s + r.commissionAmount,
      0,
    );

    return this.prisma.$transaction(async (tx) => {
      const batch = await tx.merchantSettlementBatch.create({
        data: {
          settlementNo,
          merchantPromotionSourceId: cleanId(dto.merchantPromotionSourceId),
          pickupStoreId: cleanId(dto.pickupStoreId),
          periodStart,
          periodEnd,
          recordCount: records.length,
          totalSourceAmount,
          totalCommissionAmount,
          status: 'draft',
          remark: dto.remark ?? null,
        },
      });

      await tx.merchantSettlementItem.createMany({
        data: records.map((r) => ({
          batchId: batch.id,
          commissionRecordId: r.id,
          amount: r.commissionAmount,
          status: 'included',
        })),
      });

      return batch;
    });
  }

  async confirmBatch(id: string, remark?: string) {
    const batch = await this.findBatchById(id);
    if (batch.status !== 'draft')
      throw new BadRequestException(`批次状态为${batch.status}，无法确认`);

    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.merchantSettlementBatch.update({
        where: { id: BigInt(id) },
        data: {
          status: 'confirmed',
          confirmedAt: now,
          ...(remark !== undefined ? { remark } : {}),
        },
      });
      // 关联记录状态升级为 confirmed
      const items = await tx.merchantSettlementItem.findMany({
        where: { batchId: BigInt(id), status: 'included' },
      });
      await Promise.all(
        items.map((it) =>
          tx.merchantCommissionRecord.update({
            where: { id: it.commissionRecordId },
            data: {
              status: 'confirmed',
              confirmedAt: now,
            },
          }),
        ),
      );
      return updated;
    });
  }

  async markBatchPaid(id: string, remark?: string) {
    const batch = await this.findBatchById(id);
    if (batch.status !== 'confirmed')
      throw new BadRequestException(`批次状态为${batch.status}，无法标记已付款`);

    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.merchantSettlementBatch.update({
        where: { id: BigInt(id) },
        data: {
          status: 'paid',
          paidAt: now,
          ...(remark !== undefined ? { remark } : {}),
        },
      });
      const items = await tx.merchantSettlementItem.findMany({
        where: { batchId: BigInt(id), status: 'included' },
      });
      await Promise.all(
        items.map(async (it) => {
          await tx.merchantSettlementItem.update({
            where: { id: it.id },
            data: { status: 'settled' },
          });
          await tx.merchantCommissionRecord.update({
            where: { id: it.commissionRecordId },
            data: { status: 'settled', settledAt: now },
          });
        }),
      );
      return updated;
    });
  }

  async cancelBatch(id: string, remark?: string) {
    const batch = await this.findBatchById(id);
    if (batch.status === 'paid')
      throw new BadRequestException('已付款批次不可取消');
    if (batch.status === 'cancelled')
      throw new BadRequestException('批次已取消');

    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.merchantSettlementBatch.update({
        where: { id: BigInt(id) },
        data: {
          status: 'cancelled',
          cancelledAt: now,
          ...(remark !== undefined ? { remark } : {}),
        },
      });
      // 批次内的 items 标记为 removed
      // 相关 commission_records 如果当前是 confirmed（仅由本批次升格），回退到 pending
      const items = await tx.merchantSettlementItem.findMany({
        where: { batchId: BigInt(id), status: 'included' },
      });
      await Promise.all(
        items.map(async (it) => {
          await tx.merchantSettlementItem.update({
            where: { id: it.id },
            data: { status: 'removed' },
          });
          // 检查记录是否还被其他未取消 batch 包含
          const otherItems = await tx.merchantSettlementItem.findFirst({
            where: {
              commissionRecordId: it.commissionRecordId,
              batchId: { not: BigInt(id) },
              status: { in: ['included', 'settled'] },
            },
          });
          if (!otherItems) {
            // 没有其他批次包含此记录，回退到 pending（如果当前是 confirmed）
            const record = await tx.merchantCommissionRecord.findUnique({
              where: { id: it.commissionRecordId },
            });
            if (record && record.status === 'confirmed') {
              await tx.merchantCommissionRecord.update({
                where: { id: record.id },
                data: {
                  status: 'pending',
                  confirmedAt: null,
                },
              });
            }
          }
        }),
      );
      return updated;
    });
  }

  // ============ 报表 ============

  async reportByMerchant(query: {
    merchantPromotionSourceId?: string;
    from?: string;
    to?: string;
  }) {
    const where: Prisma.MerchantCommissionRecordWhereInput = {
      deletedAt: null,
      sourceType: 'sales_referral',
    };
    if (query.merchantPromotionSourceId)
      where.merchantPromotionSourceId = BigInt(query.merchantPromotionSourceId);
    if (query.from || query.to) {
      where.occurredAt = {};
      if (query.from) where.occurredAt.gte = parseDate(query.from);
      if (query.to) where.occurredAt.lte = parseDate(query.to);
    }

    const records = await this.prisma.merchantCommissionRecord.findMany({
      where,
      select: {
        merchantPromotionSourceId: true,
        sourceAmount: true,
        commissionAmount: true,
        status: true,
      },
    });

    const map = new Map<
      string,
      {
        merchantPromotionSourceId: string;
        recordCount: number;
        totalSourceAmount: number;
        totalCommissionAmount: number;
        pendingAmount: number;
        settledAmount: number;
      }
    >();

    for (const r of records) {
      if (!r.merchantPromotionSourceId) continue;
      const key = r.merchantPromotionSourceId.toString();
      if (!map.has(key)) {
        map.set(key, {
          merchantPromotionSourceId: key,
          recordCount: 0,
          totalSourceAmount: 0,
          totalCommissionAmount: 0,
          pendingAmount: 0,
          settledAmount: 0,
        });
      }
      const entry = map.get(key)!;
      entry.recordCount++;
      entry.totalSourceAmount += r.sourceAmount;
      entry.totalCommissionAmount += r.commissionAmount;
      if (r.status === 'pending' || r.status === 'confirmed')
        entry.pendingAmount += r.commissionAmount;
      if (r.status === 'settled') entry.settledAmount += r.commissionAmount;
    }

    const list = Array.from(map.values());
    const merchantIds = list.map((l) => BigInt(l.merchantPromotionSourceId));
    const merchants = await this.prisma.merchantPromotionSource.findMany({
      where: { id: { in: merchantIds } },
      select: { id: true, name: true, promotionCode: true },
    });
    const merchantMap = new Map(
      merchants.map((m) => [m.id.toString(), m]),
    );

    return list.map((l) => ({
      ...l,
      merchantName: merchantMap.get(l.merchantPromotionSourceId)?.name ?? null,
      merchantCode:
        merchantMap.get(l.merchantPromotionSourceId)?.promotionCode ?? null,
    }));
  }

  async reportMonthly(query: {
    merchantPromotionSourceId?: string;
    from?: string;
    to?: string;
  }) {
    const where: Prisma.MerchantCommissionRecordWhereInput = { deletedAt: null };
    if (query.merchantPromotionSourceId)
      where.merchantPromotionSourceId = BigInt(query.merchantPromotionSourceId);
    if (query.from || query.to) {
      where.occurredAt = {};
      if (query.from) where.occurredAt.gte = parseDate(query.from);
      if (query.to) where.occurredAt.lte = parseDate(query.to);
    }

    const records = await this.prisma.merchantCommissionRecord.findMany({
      where,
      select: {
        sourceType: true,
        sourceAmount: true,
        commissionAmount: true,
        status: true,
        occurredAt: true,
      },
    });

    const map = new Map<
      string,
      {
        month: string;
        salesCount: number;
        salesAmount: number;
        salesCommission: number;
        serviceCount: number;
        serviceAmount: number;
        serviceCommission: number;
      }
    >();

    for (const r of records) {
      const d = r.occurredAt;
      const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!map.has(month)) {
        map.set(month, {
          month,
          salesCount: 0,
          salesAmount: 0,
          salesCommission: 0,
          serviceCount: 0,
          serviceAmount: 0,
          serviceCommission: 0,
        });
      }
      const entry = map.get(month)!;
      if (r.sourceType === 'sales_referral') {
        entry.salesCount++;
        entry.salesAmount += r.sourceAmount;
        entry.salesCommission += r.commissionAmount;
      } else if (r.sourceType === 'service_verification') {
        entry.serviceCount++;
        entry.serviceAmount += r.sourceAmount;
        entry.serviceCommission += r.commissionAmount;
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      b.month.localeCompare(a.month),
    );
  }

  // ============ 内部调用：销售分佣生成 ============

  /**
   * 订单支付成功后调用，生成销售分佣记录。
   * 幂等：通过 dedupeKey 唯一索引保证不重复。
   * 失败不影响支付主流程（调用方需 try/catch）。
   */
  async generateSalesCommission(
    orderId: bigint | string,
    userId: bigint | string,
    payAmount: number,
    sourceType: string,
    sourceCode: string,
  ): Promise<void> {
    if (sourceType !== 'merchant_referral' || !sourceCode) {
      this.logger.debug(
        `非商家推广订单，跳过分佣: orderId=${orderId}, sourceType=${sourceType}`,
      );
      return;
    }

    // 通过 sourceCode 找到商家
    const merchant = await this.prisma.merchantPromotionSource.findFirst({
      where: { promotionCode: sourceCode, deletedAt: null },
    });
    if (!merchant) {
      this.logger.debug(
        `未找到推广码对应商家: sourceCode=${sourceCode}, orderId=${orderId}`,
      );
      return;
    }

    // 匹配启用的 sales_referral 规则
    const rule = await this.matchSalesRule(merchant.id);
    if (!rule) {
      this.logger.debug(
        `无启用的销售分佣规则: merchantId=${merchant.id}, orderId=${orderId}`,
      );
      return;
    }

    const sourceAmount = payAmount || 0;
    const { amount, snapshot } = computeCommission(rule, sourceAmount);
    if (amount <= 0) {
      this.logger.debug(
        `分佣金额为0，跳过: orderId=${orderId}, ruleId=${rule.id}`,
      );
      return;
    }

    const dedupeKey = `sales_referral:order:${orderId}:merchant:${merchant.id}:rule:${rule.id}`;
    const occurredAt = new Date();

    try {
      await this.prisma.merchantCommissionRecord.create({
        data: {
          ruleId: rule.id,
          merchantPromotionSourceId: merchant.id,
          userId: BigInt(userId),
          orderId: BigInt(orderId),
          sourceType: 'sales_referral',
          sourceAmount,
          commissionAmount: amount,
          calculationSnapshot: snapshot,
          status: 'pending',
          dedupeKey,
          occurredAt,
        },
      });
      this.logger.log(
        `销售分佣记录已生成: orderId=${orderId}, merchantId=${merchant.id}, amount=${amount}`,
      );
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        this.logger.debug(
          `销售分佣记录已存在，幂等跳过: dedupeKey=${dedupeKey}`,
        );
        return;
      }
      throw e;
    }
  }

  private async matchSalesRule(merchantId: bigint) {
    const now = new Date();
    const rules = await this.prisma.merchantCommissionRule.findMany({
      where: {
        deletedAt: null,
        ruleType: 'sales_referral',
        status: 1,
        merchantPromotionSourceId: merchantId,
      },
    });
    const effective = rules.filter((r) => {
      if (r.effectiveStartAt && now < r.effectiveStartAt) return false;
      if (r.effectiveEndAt && now > r.effectiveEndAt) return false;
      return true;
    });
    if (effective.length === 0) return null;
    effective.sort((a, b) => b.priority - a.priority);
    return effective[0];
  }

  // ============ 内部调用：服务结算生成 ============

  /**
   * 权益核销成功后调用，生成服务结算记录。
   * 幂等：通过 dedupeKey 唯一索引保证不重复。
   * 失败不影响核销主流程（调用方需 try/catch）。
   */
  async generateServiceCommission(
    verificationLogId: bigint | string,
    entitlementId: bigint | string,
    packageItemId: bigint | string,
    packageId: bigint | string,
    pickupStoreId?: bigint | string | null,
    merchantPromotionSourceId?: bigint | string | null,
  ): Promise<void> {
    // 取权益项的 originalValue 作为 sourceAmount
    const item = await this.prisma.benefitPackageItem.findFirst({
      where: { id: BigInt(packageItemId) },
      select: { id: true, originalValue: true, name: true },
    });
    const sourceAmount = item?.originalValue ?? 0;

    // 匹配启用的 service_verification 规则
    const rule = await this.matchServiceRule({
      packageItemId,
      packageId,
      pickupStoreId,
      merchantPromotionSourceId,
    });
    if (!rule) {
      this.logger.debug(
        `无启用的服务结算规则: packageItemId=${packageItemId}, verificationLogId=${verificationLogId}`,
      );
      return;
    }

    const { amount, snapshot } = computeCommission(rule, sourceAmount);
    if (amount <= 0) {
      this.logger.debug(
        `服务结算金额为0，跳过: verificationLogId=${verificationLogId}, ruleId=${rule.id}`,
      );
      return;
    }

    const dedupeKey = `service_verification:verification_log:${verificationLogId}:rule:${rule.id}`;
    const occurredAt = new Date();

    try {
      await this.prisma.merchantCommissionRecord.create({
        data: {
          ruleId: rule.id,
          merchantPromotionSourceId: rule.merchantPromotionSourceId,
          pickupStoreId: rule.pickupStoreId,
          benefitPackageId: BigInt(packageId),
          benefitPackageItemId: BigInt(packageItemId),
          entitlementId: BigInt(entitlementId),
          verificationLogId: BigInt(verificationLogId),
          sourceType: 'service_verification',
          sourceAmount,
          commissionAmount: amount,
          calculationSnapshot: snapshot,
          status: 'pending',
          dedupeKey,
          occurredAt,
        },
      });
      this.logger.log(
        `服务结算记录已生成: verificationLogId=${verificationLogId}, ruleId=${rule.id}, amount=${amount}`,
      );
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        this.logger.debug(
          `服务结算记录已存在，幂等跳过: dedupeKey=${dedupeKey}`,
        );
        return;
      }
      throw e;
    }
  }

  private async matchServiceRule(params: {
    packageItemId: bigint | string;
    packageId: bigint | string;
    pickupStoreId?: bigint | string | null;
    merchantPromotionSourceId?: bigint | string | null;
  }) {
    const now = new Date();
    const where: Prisma.MerchantCommissionRuleWhereInput = {
      deletedAt: null,
      ruleType: 'service_verification',
      status: 1,
    };
    const rules = await this.prisma.merchantCommissionRule.findMany({ where });

    const isEffective = (r: any) => {
      if (r.effectiveStartAt && now < r.effectiveStartAt) return false;
      if (r.effectiveEndAt && now > r.effectiveEndAt) return false;
      return true;
    };

    const packageItemIdStr = params.packageItemId?.toString();
    const packageIdStr = params.packageId?.toString();
    const pickupStoreIdStr = params.pickupStoreId?.toString();
    const merchantPromotionSourceIdStr =
      params.merchantPromotionSourceId?.toString();

    // 优先匹配 packageItemId
    let candidates = rules.filter(
      (r) =>
        isEffective(r) &&
        packageItemIdStr &&
        r.benefitPackageItemId?.toString() === packageItemIdStr,
    );
    // 其次匹配 packageId
    if (candidates.length === 0) {
      candidates = rules.filter(
        (r) =>
          isEffective(r) &&
          packageIdStr &&
          r.benefitPackageId?.toString() === packageIdStr &&
          r.benefitPackageItemId === null,
      );
    }
    // 其次匹配 pickupStoreId
    if (candidates.length === 0 && pickupStoreIdStr) {
      candidates = rules.filter(
        (r) =>
          isEffective(r) &&
          r.pickupStoreId?.toString() === pickupStoreIdStr &&
          r.benefitPackageId === null &&
          r.benefitPackageItemId === null,
      );
    }
    // 其次匹配 merchantPromotionSourceId
    if (candidates.length === 0 && merchantPromotionSourceIdStr) {
      candidates = rules.filter(
        (r) =>
          isEffective(r) &&
          r.merchantPromotionSourceId?.toString() ===
            merchantPromotionSourceIdStr &&
          r.benefitPackageId === null &&
          r.benefitPackageItemId === null &&
          r.pickupStoreId === null,
      );
    }
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b.priority - a.priority);
    return candidates[0];
  }
}
