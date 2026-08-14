import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as crypto from 'crypto';
import { RedisService } from '../common/redis/redis.service';
import { MerchantSettlementService } from './merchant-settlement.service';
import { SerializedSalesMerchantSettlementService } from './serialized-sales-merchant-settlement.service';

const LOCK_KEY = 'schedule:merchant_settlement_debt_reconcile';
const LOCK_TTL_SECONDS = 1800;

@Injectable()
export class MerchantSettlementDebtReconcileSchedule {
  private readonly logger = new Logger(MerchantSettlementDebtReconcileSchedule.name);

  constructor(
    @Inject(MerchantSettlementService)
    private readonly settlementService: SerializedSalesMerchantSettlementService,
    private readonly redisService: RedisService,
  ) {}

  @Cron('0 17 * * * *')
  async reconcileOutstandingSalesDebts(): Promise<void> {
    const token = `${process.pid}-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    const acquired = await this.redisService.setNX(LOCK_KEY, token, LOCK_TTL_SECONDS);
    if (!acquired) return;

    try {
      const result = await this.settlementService.reconcileOutstandingSalesDebts(200);
      if (result.reconciled > 0 || result.failed > 0) {
        this.logger.log(`销售分佣退款负债补偿完成: ${JSON.stringify(result)}`);
      }
    } catch (error) {
      this.logger.error(
        `销售分佣退款负债补偿失败: ${(error as Error).message}`,
        (error as Error).stack,
      );
    } finally {
      await this.redisService.releaseLockWithLua(LOCK_KEY, token);
    }
  }
}
