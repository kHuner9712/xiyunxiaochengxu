import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { RefundSafeProductionMerchantSettlementService } from './refund-safe-production-merchant-settlement.service';

const INCLUDED_EVENT = 'settlement_item_included_snapshot';
const CANCELLED_EVENT = 'settlement_item_cancelled_snapshot';
const BATCH_BIZ_TYPE = 'merchant_settlement_batch';

@Injectable()
export class StateSafeProductionMerchantSettlementService extends RefundSafeProductionMerchantSettlementService {
  constructor(private readonly statePrisma: PrismaService) {
    super(statePrisma);
  }

  override async updateRecordStatus(id: string, status: string, remark?: string) {
    const recordId = BigInt(id);
    return this.statePrisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM merchant_commission_records WHERE id = ${recordId} FOR UPDATE`;
      const record = await tx.merchantCommissionRecord.findFirst({
        where: { id: recordId, deletedAt: null },
      });
      if (!record) throw new NotFoundException('记录不存在');

      const activeItem = await tx.merchantSettlementItem.findFirst({
        where: {
          commissionRecordId: recordId,
          status: { in: ['included', 'settled'] },
        },
      });
      if (activeItem) {
        throw new BadRequestException('该分佣已进入结算批次，请通过批次操作变更状态');
      }

      if (record.status === 'settled' && status !== 'settled') {
        throw new BadRequestException('已结算分佣不可回退状态');
      }
      const allowed: Record<string, string[]> = {
        pending: ['pending', 'confirmed', 'cancelled'],
        confirmed: ['pending', 'confirmed', 'settled', 'cancelled'],
        settled: ['settled'],
        cancelled: ['cancelled', 'pending'],
      };
      if (!allowed[record.status]?.includes(status)) {
        throw new BadRequestException(`分佣状态不能从${record.status}变更为${status}`);
      }

      const now = new Date();
      const data: Prisma.MerchantCommissionRecordUpdateManyMutationInput = {
        status,
        ...(remark !== undefined ? { remark } : {}),
      };
      if (status === 'pending') {
        data.confirmedAt = null;
        data.settledAt = null;
        data.cancelledAt = null;
      } else if (status === 'confirmed') {
        data.confirmedAt = record.confirmedAt ?? now;
        data.settledAt = null;
        data.cancelledAt = null;
      } else if (status === 'settled') {
        data.settledAt = record.settledAt ?? now;
        data.cancelledAt = null;
      } else if (status === 'cancelled') {
        data.cancelledAt = record.cancelledAt ?? now;
      }

      const claimed = await tx.merchantCommissionRecord.updateMany({
        where: { id: recordId, status: record.status, deletedAt: null },
        data,
      });
      if (claimed.count !== 1) {
        throw new BadRequestException('分佣状态已变化，请刷新后重试');
      }

      await tx.businessEvent.create({
        data: {
          eventType: 'commission_record_manual_status',
          bizType: 'merchant_commission_record',
          bizId: recordId.toString(),
          level: 'info',
          message: `管理员手工变更分佣状态：${record.status} -> ${status}`,
          payload: {
            previousStatus: record.status,
            nextStatus: status,
            remark: remark ?? null,
          },
        },
      });

      return tx.merchantCommissionRecord.findUniqueOrThrow({ where: { id: recordId } });
    });
  }

  override async createBatch(dto: {
    merchantPromotionSourceId?: string;
    pickupStoreId?: string;
    periodStart: string;
    periodEnd: string;
    remark?: string;
  }) {
    const periodStart = new Date(dto.periodStart);
    const periodEnd = new Date(dto.periodEnd);
    if (!Number.isFinite(periodStart.getTime()) || !Number.isFinite(periodEnd.getTime())) {
      throw new BadRequestException('周期起止时间不能为空');
    }
    if (periodStart >= periodEnd) {
      throw new BadRequestException('周期开始时间必须早于结束时间');
    }

    return this.statePrisma.$transaction(async (tx) => {
      const candidates = await tx.merchantCommissionRecord.findMany({
        where: {
          deletedAt: null,
          status: { in: ['pending', 'confirmed'] },
          occurredAt: { gte: periodStart, lte: periodEnd },
          commissionAmount: { gt: 0 },
          ...(dto.merchantPromotionSourceId
            ? { merchantPromotionSourceId: BigInt(dto.merchantPromotionSourceId) }
            : {}),
          ...(dto.pickupStoreId ? { pickupStoreId: BigInt(dto.pickupStoreId) } : {}),
        },
        orderBy: { id: 'asc' },
      });

      const eligible: typeof candidates = [];
      for (const candidate of candidates) {
        await tx.$queryRaw`SELECT id FROM merchant_commission_records WHERE id = ${candidate.id} FOR UPDATE`;
        const current = await tx.merchantCommissionRecord.findUnique({ where: { id: candidate.id } });
        if (
          !current ||
          current.deletedAt ||
          !['pending', 'confirmed'].includes(current.status) ||
          current.commissionAmount <= 0 ||
          current.occurredAt < periodStart ||
          current.occurredAt > periodEnd
        ) {
          continue;
        }

        const existingItem = await tx.merchantSettlementItem.findUnique({
          where: { commissionRecordId: current.id },
        });
        if (existingItem?.status === 'included' || existingItem?.status === 'settled') {
          continue;
        }
        if (existingItem?.status === 'removed') {
          await this.archiveLegacyRemovedItem(tx, existingItem, current);
          await tx.merchantSettlementItem.delete({ where: { id: existingItem.id } });
        }
        eligible.push(current);
      }

      if (eligible.length === 0) {
        throw new BadRequestException('所选范围内无可结算记录');
      }

      const batch = await this.createBatchWithUniqueNo(tx, {
        merchantPromotionSourceId: dto.merchantPromotionSourceId
          ? BigInt(dto.merchantPromotionSourceId)
          : null,
        pickupStoreId: dto.pickupStoreId ? BigInt(dto.pickupStoreId) : null,
        periodStart,
        periodEnd,
        recordCount: eligible.length,
        totalSourceAmount: eligible.reduce((sum, record) => sum + record.sourceAmount, 0),
        totalCommissionAmount: eligible.reduce(
          (sum, record) => sum + record.commissionAmount,
          0,
        ),
        remark: dto.remark ?? null,
      });

      for (const record of eligible) {
        const item = await tx.merchantSettlementItem.create({
          data: {
            batchId: batch.id,
            commissionRecordId: record.id,
            amount: record.commissionAmount,
            status: 'included',
          },
        });
        await tx.businessEvent.create({
          data: {
            eventType: INCLUDED_EVENT,
            bizType: BATCH_BIZ_TYPE,
            bizId: batch.id.toString(),
            level: 'info',
            message: `分佣记录${record.id}进入结算批次${batch.settlementNo}`,
            payload: {
              itemId: item.id.toString(),
              commissionRecordId: record.id.toString(),
              amount: record.commissionAmount,
              sourceAmount: record.sourceAmount,
              sourceType: record.sourceType,
              originalRecordStatus: record.status,
              originalConfirmedAt: record.confirmedAt?.toISOString() ?? null,
              merchantPromotionSourceId: record.merchantPromotionSourceId?.toString() ?? null,
              pickupStoreId: record.pickupStoreId?.toString() ?? null,
              orderId: record.orderId?.toString() ?? null,
              verificationLogId: record.verificationLogId?.toString() ?? null,
            },
          },
        });
      }

      return batch;
    });
  }

  override async confirmBatch(id: string, remark?: string) {
    const batchId = BigInt(id);
    return this.statePrisma.$transaction(async (tx) => {
      const context = await this.lockBatchContext(tx, batchId);
      if (context.batch.status !== 'draft') {
        throw new BadRequestException(`批次状态为${context.batch.status}，无法确认`);
      }
      const included = context.items.filter((item) => item.status === 'included');
      if (included.length === 0) throw new BadRequestException('批次没有可确认的结算明细');

      const now = new Date();
      for (const item of included) {
        const record = context.records.get(item.commissionRecordId.toString());
        if (!record || !['pending', 'confirmed'].includes(record.status) || record.commissionAmount <= 0) {
          throw new BadRequestException(`分佣记录${item.commissionRecordId}状态已变化，请重新生成批次`);
        }
        if (record.status === 'pending') {
          const claimed = await tx.merchantCommissionRecord.updateMany({
            where: { id: record.id, status: 'pending', deletedAt: null },
            data: { status: 'confirmed', confirmedAt: now },
          });
          if (claimed.count !== 1) throw new BadRequestException('分佣状态已变化，请刷新后重试');
        }
      }

      const claimed = await tx.merchantSettlementBatch.updateMany({
        where: { id: batchId, status: 'draft', deletedAt: null },
        data: {
          status: 'confirmed',
          confirmedAt: now,
          ...(remark !== undefined ? { remark } : {}),
        },
      });
      if (claimed.count !== 1) throw new BadRequestException('批次状态已变化，请刷新后重试');

      return tx.merchantSettlementBatch.findUniqueOrThrow({ where: { id: batchId } });
    });
  }

  override async markBatchPaid(id: string, remark?: string) {
    const batchId = BigInt(id);
    return this.statePrisma.$transaction(async (tx) => {
      const context = await this.lockBatchContext(tx, batchId);
      if (context.batch.status !== 'confirmed') {
        throw new BadRequestException(`批次状态为${context.batch.status}，无法标记已付款`);
      }
      const included = context.items.filter((item) => item.status === 'included');
      if (included.length === 0) throw new BadRequestException('批次没有可付款的结算明细');

      for (const item of included) {
        const record = context.records.get(item.commissionRecordId.toString());
        if (!record || record.status !== 'confirmed' || record.commissionAmount <= 0) {
          throw new BadRequestException(`分佣记录${item.commissionRecordId}状态异常，禁止付款`);
        }
      }

      const now = new Date();
      const batchClaim = await tx.merchantSettlementBatch.updateMany({
        where: { id: batchId, status: 'confirmed', deletedAt: null },
        data: {
          status: 'paid',
          paidAt: now,
          ...(remark !== undefined ? { remark } : {}),
        },
      });
      if (batchClaim.count !== 1) throw new BadRequestException('批次状态已变化，请刷新后重试');

      for (const item of included) {
        const itemClaim = await tx.merchantSettlementItem.updateMany({
          where: { id: item.id, batchId, status: 'included' },
          data: { status: 'settled' },
        });
        const recordClaim = await tx.merchantCommissionRecord.updateMany({
          where: { id: item.commissionRecordId, status: 'confirmed', deletedAt: null },
          data: { status: 'settled', settledAt: now },
        });
        if (itemClaim.count !== 1 || recordClaim.count !== 1) {
          throw new BadRequestException('结算明细状态已变化，付款操作已回滚');
        }
      }

      await tx.businessEvent.create({
        data: {
          eventType: 'settlement_batch_paid',
          bizType: BATCH_BIZ_TYPE,
          bizId: batchId.toString(),
          level: 'info',
          message: `结算批次${context.batch.settlementNo}已标记付款`,
          payload: {
            recordCount: included.length,
            totalCommissionAmount: context.batch.totalCommissionAmount,
          },
        },
      });

      return tx.merchantSettlementBatch.findUniqueOrThrow({ where: { id: batchId } });
    });
  }

  override async cancelBatch(id: string, remark?: string) {
    const batchId = BigInt(id);
    return this.statePrisma.$transaction(async (tx) => {
      const context = await this.lockBatchContext(tx, batchId);
      if (context.batch.status === 'paid') throw new BadRequestException('已付款批次不可取消');
      if (context.batch.status === 'cancelled') throw new BadRequestException('批次已取消');
      if (!['draft', 'confirmed'].includes(context.batch.status)) {
        throw new BadRequestException(`批次状态为${context.batch.status}，无法取消`);
      }
      if (context.items.some((item) => item.status === 'settled')) {
        throw new BadRequestException('批次包含已结算明细，不能取消');
      }

      const inclusionEvents = await tx.businessEvent.findMany({
        where: {
          eventType: INCLUDED_EVENT,
          bizType: BATCH_BIZ_TYPE,
          bizId: batchId.toString(),
        },
        orderBy: { createdAt: 'asc' },
      });
      const inclusionByRecordId = new Map<string, Record<string, any>>();
      for (const event of inclusionEvents) {
        const payload = (event.payload ?? {}) as Record<string, any>;
        const commissionRecordId = String(payload.commissionRecordId ?? '');
        if (commissionRecordId && !inclusionByRecordId.has(commissionRecordId)) {
          inclusionByRecordId.set(commissionRecordId, payload);
        }
      }

      const now = new Date();
      const batchClaim = await tx.merchantSettlementBatch.updateMany({
        where: { id: batchId, status: context.batch.status, deletedAt: null },
        data: {
          status: 'cancelled',
          cancelledAt: now,
          ...(remark !== undefined ? { remark } : {}),
        },
      });
      if (batchClaim.count !== 1) throw new BadRequestException('批次状态已变化，请刷新后重试');

      for (const item of context.items) {
        const record = context.records.get(item.commissionRecordId.toString()) ?? null;
        const inclusionPayload = inclusionByRecordId.get(item.commissionRecordId.toString()) ?? {};
        let originalRecordStatus = String(inclusionPayload.originalRecordStatus || '');
        if (!originalRecordStatus && record) {
          originalRecordStatus = record.confirmedAt && record.confirmedAt <= context.batch.createdAt
            ? 'confirmed'
            : 'pending';
        }

        if (
          context.batch.status === 'confirmed' &&
          item.status === 'included' &&
          record?.status === 'confirmed' &&
          originalRecordStatus === 'pending'
        ) {
          const restore = await tx.merchantCommissionRecord.updateMany({
            where: { id: record.id, status: 'confirmed', deletedAt: null },
            data: { status: 'pending', confirmedAt: null },
          });
          if (restore.count !== 1) throw new BadRequestException('分佣状态已变化，取消操作已回滚');
        }

        await tx.businessEvent.create({
          data: {
            eventType: CANCELLED_EVENT,
            bizType: BATCH_BIZ_TYPE,
            bizId: batchId.toString(),
            level: 'info',
            message: `结算批次${context.batch.settlementNo}取消，释放分佣记录${item.commissionRecordId}`,
            payload: {
              itemId: item.id.toString(),
              commissionRecordId: item.commissionRecordId.toString(),
              amount: item.amount,
              itemStatusAtCancel: item.status,
              originalRecordStatus: originalRecordStatus || null,
              recordStatusAtCancel: record?.status ?? null,
              sourceAmount: record?.sourceAmount ?? null,
              commissionAmount: record?.commissionAmount ?? item.amount,
              sourceType: record?.sourceType ?? null,
              merchantPromotionSourceId: record?.merchantPromotionSourceId?.toString() ?? null,
              pickupStoreId: record?.pickupStoreId?.toString() ?? null,
              orderId: record?.orderId?.toString() ?? null,
              verificationLogId: record?.verificationLogId?.toString() ?? null,
              cancelledAt: now.toISOString(),
            },
          },
        });

        await tx.merchantSettlementItem.delete({ where: { id: item.id } });
      }

      return tx.merchantSettlementBatch.findUniqueOrThrow({ where: { id: batchId } });
    });
  }

  override async findBatchById(id: string): Promise<any> {
    const batch = await super.findBatchById(id);
    if (batch.status !== 'cancelled' || (batch.items?.length ?? 0) > 0) return batch;

    const events = await this.statePrisma.businessEvent.findMany({
      where: {
        eventType: CANCELLED_EVENT,
        bizType: BATCH_BIZ_TYPE,
        bizId: BigInt(id).toString(),
      },
      orderBy: { createdAt: 'asc' },
    });
    if (events.length === 0) return batch;

    return {
      ...batch,
      items: events.map((event) => {
        const payload = (event.payload ?? {}) as Record<string, any>;
        return {
          id: event.id.toString(),
          batchId: BigInt(id).toString(),
          commissionRecordId: payload.commissionRecordId ?? null,
          amount: payload.amount ?? payload.commissionAmount ?? 0,
          status: 'removed',
          createdAt: event.createdAt,
          updatedAt: event.createdAt,
          record: {
            id: payload.commissionRecordId ?? null,
            sourceAmount: payload.sourceAmount ?? null,
            commissionAmount: payload.commissionAmount ?? payload.amount ?? 0,
            sourceType: payload.sourceType ?? null,
            merchantPromotionSourceId: payload.merchantPromotionSourceId ?? null,
            pickupStoreId: payload.pickupStoreId ?? null,
            orderId: payload.orderId ?? null,
            verificationLogId: payload.verificationLogId ?? null,
            status: payload.recordStatusAtCancel ?? payload.originalRecordStatus ?? null,
          },
        };
      }),
    };
  }

  private async lockBatchContext(tx: Prisma.TransactionClient, batchId: bigint) {
    const initialItems = await tx.merchantSettlementItem.findMany({
      where: { batchId },
      orderBy: { commissionRecordId: 'asc' },
    });
    for (const item of initialItems) {
      await tx.$queryRaw`SELECT id FROM merchant_commission_records WHERE id = ${item.commissionRecordId} FOR UPDATE`;
    }
    await tx.$queryRaw`SELECT id FROM merchant_settlement_batches WHERE id = ${batchId} FOR UPDATE`;

    const batch = await tx.merchantSettlementBatch.findFirst({
      where: { id: batchId, deletedAt: null },
    });
    if (!batch) throw new NotFoundException('结算批次不存在');
    const items = await tx.merchantSettlementItem.findMany({
      where: { batchId },
      orderBy: { commissionRecordId: 'asc' },
    });
    const recordIds = Array.from(new Set(items.map((item) => item.commissionRecordId.toString())))
      .map((recordId) => BigInt(recordId));
    const records = recordIds.length
      ? await tx.merchantCommissionRecord.findMany({ where: { id: { in: recordIds } } })
      : [];
    return {
      batch,
      items,
      records: new Map(records.map((record) => [record.id.toString(), record])),
    };
  }

  private async createBatchWithUniqueNo(
    tx: Prisma.TransactionClient,
    data: {
      merchantPromotionSourceId: bigint | null;
      pickupStoreId: bigint | null;
      periodStart: Date;
      periodEnd: Date;
      recordCount: number;
      totalSourceAmount: number;
      totalCommissionAmount: number;
      remark: string | null;
    },
  ) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const settlementNo = this.generateSettlementNo();
      try {
        return await tx.merchantSettlementBatch.create({
          data: {
            settlementNo,
            merchantPromotionSourceId: data.merchantPromotionSourceId,
            pickupStoreId: data.pickupStoreId,
            periodStart: data.periodStart,
            periodEnd: data.periodEnd,
            recordCount: data.recordCount,
            totalSourceAmount: data.totalSourceAmount,
            totalCommissionAmount: data.totalCommissionAmount,
            status: 'draft',
            remark: data.remark,
          },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          continue;
        }
        throw error;
      }
    }
    throw new BadRequestException('结算单号生成冲突，请重试');
  }

  private generateSettlementNo() {
    const now = new Date();
    const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const time = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    const nonce = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    return `SETTLE${date}${time}${nonce}`;
  }

  private async archiveLegacyRemovedItem(
    tx: Prisma.TransactionClient,
    item: { id: bigint; batchId: bigint; commissionRecordId: bigint; amount: number; status: string },
    record: { id: bigint; sourceAmount: number; commissionAmount: number; sourceType: string; status: string },
  ) {
    const oldBatch = await tx.merchantSettlementBatch.findUnique({ where: { id: item.batchId } });
    if (!oldBatch || oldBatch.status !== 'cancelled') {
      throw new BadRequestException(`分佣记录${record.id}已有异常结算占用，请先处理历史批次`);
    }
    const existingArchive = await tx.businessEvent.findFirst({
      where: {
        eventType: CANCELLED_EVENT,
        bizType: BATCH_BIZ_TYPE,
        bizId: item.batchId.toString(),
        message: { contains: `释放分佣记录${record.id}` },
      },
    });
    if (existingArchive) return;

    await tx.businessEvent.create({
      data: {
        eventType: CANCELLED_EVENT,
        bizType: BATCH_BIZ_TYPE,
        bizId: item.batchId.toString(),
        level: 'warn',
        message: `迁移历史取消批次明细，释放分佣记录${record.id}`,
        payload: {
          itemId: item.id.toString(),
          commissionRecordId: record.id.toString(),
          amount: item.amount,
          itemStatusAtCancel: item.status,
          originalRecordStatus: null,
          recordStatusAtCancel: record.status,
          sourceAmount: record.sourceAmount,
          commissionAmount: record.commissionAmount,
          sourceType: record.sourceType,
          legacyRecovered: true,
        },
      },
    });
  }
}
