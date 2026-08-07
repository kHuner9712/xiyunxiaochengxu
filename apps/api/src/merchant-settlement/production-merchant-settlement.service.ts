import { Injectable, Logger } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { AFTERSALE_APPLY_DAYS } from '@baby-mall/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { MerchantSettlementService } from './merchant-settlement.service';

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
      },
    });
    if (!order || order.status !== OrderStatus.completed || !order.completedAt) {
      return;
    }

    const matureAt = new Date(
      order.completedAt.getTime() + AFTERSALE_APPLY_DAYS * 24 * 60 * 60 * 1000,
    );
    if (matureAt > new Date()) return;

    const successfulRefund = await this.productionPrisma.orderRefund.findFirst({
      where: { orderId: order.id, status: 'success' },
      select: { id: true },
    });
    if (successfulRefund) return;

    await super.generateSalesCommission(orderId, userId, payAmount, sourceType, sourceCode);
    await this.applyOutstandingMerchantDebt(order.id);
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
        const created = await this.productionPrisma.merchantCommissionRecord.findFirst({
          where: {
            orderId: order.id,
            sourceType: 'sales_referral',
            deletedAt: null,
          },
          select: { id: true },
        });
        if (created) generated += 1;
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

      const remainingSource = Math.max(0, originalSource - totalRefunded);
      const targetCommission = Math.max(
        0,
        Math.floor((originalCommission * remainingSource) / originalSource),
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
              sourceAmount: -Math.min(totalRefunded, originalSource),
              commissionAmount: -reversalAmount,
              calculationSnapshot: {
                originalRecordId: record.id.toString(),
                refundId: String(refundId),
                totalRefunded,
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

        const newSourceAmount = Math.max(0, originalSource - totalRefunded);
        await tx.merchantCommissionRecord.update({
          where: { id: record.id },
          data: {
            sourceAmount: newSourceAmount,
            commissionAmount: targetCommission,
            ...(targetCommission === 0
              ? { status: 'cancelled', cancelledAt: new Date() }
              : {}),
            remark: `订单退款后自动冲减分佣，累计退款${totalRefunded}分`,
          },
        });

        if (lockedItem && lockedBatch && lockedItem.status === 'included') {
          const commissionDelta = lockedItem.amount - targetCommission;
          const sourceDelta = Math.max(0, record.sourceAmount - newSourceAmount);
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