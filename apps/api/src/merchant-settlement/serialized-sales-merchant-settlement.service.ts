import { BadRequestException, Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { SnapshotAwareStateSafeMerchantSettlementService } from './snapshot-aware-state-safe-merchant-settlement.service';

const SALES_SETTLEMENT_LOCK_TTL_SECONDS = 120;

/**
 * Serializes sales-commission generation and refund reversal per merchant.
 *
 * Sales commission is single-rule by design: one merchant referral order must never gain a second
 * `sales_referral` ledger row merely because the active rule changed between retries. The same
 * merchant-level boundary also protects outstanding refund-debt consumption and closes the race
 * where refund reversal can observe "no commission yet" while commission generation observes the
 * pre-refund paid amount.
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

    await this.withMerchantSalesLock(sourceCode, async () => {
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
    const order = await this.serializedPrisma.order.findUnique({
      where: { id: BigInt(orderId) },
      select: { sourceType: true, sourceCode: true },
    });
    if (order?.sourceType !== 'merchant_referral' || !order.sourceCode) {
      return super.reverseSalesCommissionAfterRefund(orderId, refundId);
    }

    return this.withMerchantSalesLock(order.sourceCode, () =>
      super.reverseSalesCommissionAfterRefund(orderId, refundId),
    );
  }

  private async withMerchantSalesLock<T>(sourceCode: string, action: () => Promise<T>): Promise<T> {
    const merchantKey = crypto.createHash('sha256').update(sourceCode).digest('hex');
    const key = `merchant:settlement:sales:${merchantKey}`;
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
