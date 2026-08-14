import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../common/redis/redis.service';
import { PaymentReconcileService } from './payment-reconcile.service';

const RECONCILE_LOCK_TTL_SECONDS = 240;

@Injectable()
export class PaymentReconcileExecutionService {
  private readonly logger = new Logger(PaymentReconcileExecutionService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly reconcileService: PaymentReconcileService,
  ) {}

  async reconcilePayments() {
    return this.runWithLease(
      'schedule:payment_reconcile',
      '支付对账',
      () => this.reconcileService.reconcilePendingPayments(),
    );
  }

  async reconcileRefunds() {
    return this.runWithLease(
      'schedule:refund_reconcile',
      '退款对账',
      () => this.reconcileService.reconcilePendingRefunds(),
    );
  }

  private async runWithLease<T>(
    lockKey: string,
    operationName: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const lockValue = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const acquired = await this.redisService.setNX(
      lockKey,
      lockValue,
      RECONCILE_LOCK_TTL_SECONDS,
    );
    if (!acquired) {
      throw new ConflictException(`${operationName}正在执行或系统处于维护状态，请稍后重试`);
    }

    let finished = false;
    const heartbeatIntervalMs = Math.max(
      1000,
      Math.floor((RECONCILE_LOCK_TTL_SECONDS * 1000) / 3),
    );
    const heartbeat = setInterval(() => {
      void this.redisService
        .extendLockWithLua(lockKey, lockValue, RECONCILE_LOCK_TTL_SECONDS)
        .then((renewed) => {
          if (finished) return;
          if (!renewed) {
            this.logger.error(`${operationName} Redis lease 续租失败，锁所有权已丢失：key=${lockKey}`);
          }
        })
        .catch((error) => {
          if (finished) return;
          this.logger.error(
            `${operationName} Redis lease 续租异常：key=${lockKey}, error=${(error as Error).message}`,
          );
        });
    }, heartbeatIntervalMs);
    heartbeat.unref?.();

    try {
      return await operation();
    } finally {
      finished = true;
      clearInterval(heartbeat);
      try {
        const released = await this.redisService.releaseLockWithLua(lockKey, lockValue);
        if (!released) {
          this.logger.warn(`${operationName}结束时 Redis lease 已不再属于当前执行者：key=${lockKey}`);
        }
      } catch (error) {
        this.logger.warn(
          `${operationName}释放 Redis lease 失败：key=${lockKey}, error=${(error as Error).message}`,
        );
      }
    }
  }
}
