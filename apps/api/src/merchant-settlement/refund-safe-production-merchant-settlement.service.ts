import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { ProductionMerchantSettlementService } from './production-merchant-settlement.service';

@Injectable()
export class RefundSafeProductionMerchantSettlementService extends ProductionMerchantSettlementService {
  constructor(private readonly refundPrisma: PrismaService) {
    super(refundPrisma);
  }

  override async reverseSalesCommissionAfterRefund(
    orderId: bigint | string,
    refundId: bigint | string,
  ) {
    const orderIdValue = BigInt(orderId);
    const order = await this.refundPrisma.order.findUnique({
      where: { id: orderIdValue },
      select: { id: true, payAmount: true },
    });
    if (!order || !order.payAmount || order.payAmount <= 0) {
      return { adjusted: 0, debtCreated: 0 };
    }

    const refunded = await this.refundPrisma.orderRefund.aggregate({
      where: { orderId: orderIdValue, status: 'success' },
      _sum: { refundAmount: true },
    });
    const totalRefunded = Math.min(order.payAmount, refunded._sum.refundAmount ?? 0);
    if (totalRefunded <= 0) return { adjusted: 0, debtCreated: 0 };
    const netOrderRevenue = Math.max(0, order.payAmount - totalRefunded);

    const records = await this.refundPrisma.merchantCommissionRecord.findMany({
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

      const item = await this.refundPrisma.merchantSettlementItem.findUnique({
        where: { commissionRecordId: record.id },
      });
      const batch = item
        ? await this.refundPrisma.merchantSettlementBatch.findUnique({
            where: { id: item.batchId },
          })
        : null;

      if (
        record.status === 'settled' ||
        item?.status === 'settled' ||
        batch?.status === 'paid'
      ) {
        const created = await this.refundPrisma.$transaction((tx) =>
          this.createIncrementalRefundDebt(tx, {
            recordId: record.id,
            refundId: String(refundId),
            totalRefunded,
            netOrderRevenue,
            fallbackOrderPayAmount: order.payAmount!,
          }),
        );
        if (created) debtCreated += 1;
        continue;
      }

      const outcome = await this.refundPrisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM merchant_commission_records WHERE id = ${record.id} FOR UPDATE`;
        const lockedRecord = await tx.merchantCommissionRecord.findUnique({ where: { id: record.id } });
        if (!lockedRecord || lockedRecord.status === 'cancelled') {
          return { adjusted: false, debtCreated: false };
        }

        const lockedItem = await tx.merchantSettlementItem.findUnique({
          where: { commissionRecordId: record.id },
        });
        const lockedBatch = lockedItem
          ? await tx.merchantSettlementBatch.findUnique({ where: { id: lockedItem.batchId } })
          : null;

        if (
          lockedRecord.status === 'settled' ||
          lockedItem?.status === 'settled' ||
          lockedBatch?.status === 'paid'
        ) {
          const created = await this.createIncrementalRefundDebt(tx, {
            recordId: record.id,
            refundId: String(refundId),
            totalRefunded,
            netOrderRevenue,
            fallbackOrderPayAmount: order.payAmount!,
            alreadyLocked: true,
          });
          return { adjusted: false, debtCreated: created };
        }

        const lockedSnapshot = (lockedRecord.calculationSnapshot ?? {}) as Record<string, unknown>;
        const lockedOriginalCommission = Number(
          lockedSnapshot.finalAmount ?? lockedRecord.commissionAmount,
        );
        const lockedOriginalSource = Number(
          lockedSnapshot.sourceAmount ?? order.payAmount,
        );
        if (
          !Number.isFinite(lockedOriginalCommission) ||
          lockedOriginalCommission <= 0 ||
          !Number.isFinite(lockedOriginalSource) ||
          lockedOriginalSource <= 0 ||
          netOrderRevenue >= lockedOriginalSource
        ) {
          return { adjusted: false, debtCreated: false };
        }

        const targetSource = Math.max(0, netOrderRevenue);
        const targetCommission = Math.max(
          0,
          Math.floor((lockedOriginalCommission * targetSource) / lockedOriginalSource),
        );
        if (lockedRecord.commissionAmount <= targetCommission) {
          return { adjusted: false, debtCreated: false };
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
          const commissionDelta = Math.max(0, lockedItem.amount - targetCommission);
          const sourceDelta = Math.max(0, lockedRecord.sourceAmount - targetSource);
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
        return { adjusted: true, debtCreated: false };
      });

      if (outcome.adjusted) adjusted += 1;
      if (outcome.debtCreated) debtCreated += 1;
    }

    return { adjusted, debtCreated };
  }

  private async createIncrementalRefundDebt(
    tx: Prisma.TransactionClient,
    params: {
      recordId: bigint;
      refundId: string;
      totalRefunded: number;
      netOrderRevenue: number;
      fallbackOrderPayAmount: number;
      alreadyLocked?: boolean;
    },
  ): Promise<boolean> {
    if (!params.alreadyLocked) {
      await tx.$queryRaw`SELECT id FROM merchant_commission_records WHERE id = ${params.recordId} FOR UPDATE`;
    }
    const record = await tx.merchantCommissionRecord.findUnique({
      where: { id: params.recordId },
    });
    if (!record || record.status === 'cancelled') return false;

    const snapshot = (record.calculationSnapshot ?? {}) as Record<string, unknown>;
    const originalCommission = Number(snapshot.finalAmount ?? record.commissionAmount);
    const originalSource = Number(snapshot.sourceAmount ?? params.fallbackOrderPayAmount);
    if (
      !Number.isFinite(originalCommission) ||
      originalCommission <= 0 ||
      !Number.isFinite(originalSource) ||
      originalSource <= 0 ||
      params.netOrderRevenue >= originalSource
    ) {
      return false;
    }

    const targetSource = Math.max(0, params.netOrderRevenue);
    const targetCommission = Math.max(
      0,
      Math.floor((originalCommission * targetSource) / originalSource),
    );
    const targetCumulativeReversal = Math.max(0, originalCommission - targetCommission);
    const targetCumulativeSourceReversal = Math.max(0, originalSource - targetSource);

    const priorDebts = await tx.merchantCommissionRecord.findMany({
      where: {
        orderId: record.orderId,
        sourceType: 'sales_referral_refund_debt',
        deletedAt: null,
      },
      select: {
        sourceAmount: true,
        commissionAmount: true,
        calculationSnapshot: true,
      },
    });

    let recognizedReversal = 0;
    let recognizedSourceReversal = 0;
    for (const debt of priorDebts) {
      const debtSnapshot = (debt.calculationSnapshot ?? {}) as Record<string, unknown>;
      if (String(debtSnapshot.originalRecordId ?? '') !== record.id.toString()) continue;

      const snapReversal = Number(debtSnapshot.reversalAmount);
      recognizedReversal += Number.isFinite(snapReversal) && snapReversal >= 0
        ? snapReversal
        : Math.max(0, -debt.commissionAmount);

      const snapSourceReversal = Number(debtSnapshot.sourceReversalAmount);
      recognizedSourceReversal += Number.isFinite(snapSourceReversal) && snapSourceReversal >= 0
        ? snapSourceReversal
        : Math.max(0, -debt.sourceAmount);
    }

    const incrementalReversal = Math.max(0, targetCumulativeReversal - recognizedReversal);
    if (incrementalReversal <= 0) return false;
    const incrementalSourceReversal = Math.max(
      0,
      targetCumulativeSourceReversal - recognizedSourceReversal,
    );

    const dedupeKey = `sales_referral_refund_debt:refund:${params.refundId}:record:${record.id}`;
    try {
      await tx.merchantCommissionRecord.create({
        data: {
          ruleId: record.ruleId,
          merchantPromotionSourceId: record.merchantPromotionSourceId,
          userId: record.userId,
          orderId: record.orderId,
          sourceType: 'sales_referral_refund_debt',
          sourceAmount: -incrementalSourceReversal,
          commissionAmount: -incrementalReversal,
          calculationSnapshot: {
            originalRecordId: record.id.toString(),
            refundId: params.refundId,
            cumulativeRefunded: params.totalRefunded,
            targetSource,
            targetCommission,
            targetCumulativeReversal,
            previousRecognizedReversal: recognizedReversal,
            reversalAmount: incrementalReversal,
            sourceReversalAmount: incrementalSourceReversal,
          },
          status: 'pending',
          dedupeKey,
          occurredAt: new Date(),
          remark: '已结算销售分佣发生退款，按累计退款差额生成后续抵扣负债',
        },
      });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return false;
      }
      throw error;
    }
  }
}
