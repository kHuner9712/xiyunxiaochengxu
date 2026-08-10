import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RedisService } from '../common/redis/redis.service';
import { PointsService } from './points.service';

const POINTS_EXPIRY_LOCK_KEY = 'schedule:points_expiry_cleanup';
const POINTS_EXPIRY_LOCK_TTL_SECONDS = 1800;

/**
 * Durable runtime trigger for points expiry.
 *
 * PointsService owns the FIFO/idempotent accounting rules. This scheduler only guarantees that
 * those rules are executed automatically in production instead of depending on an operator to
 * call the admin expire-clean endpoint. The Redis lock keeps multiple API replicas from running
 * the same batch concurrently; the ledger's expiry markers remain the final idempotency guard.
 */
@Injectable()
export class PointsExpiryScheduleService implements OnModuleDestroy {
  private readonly logger = new Logger(PointsExpiryScheduleService.name);
  private shuttingDown = false;
  private activeRun: Promise<void> | null = null;

  constructor(
    private readonly redisService: RedisService,
    private readonly pointsService: PointsService,
  ) {}

  @Cron('0 */10 * * * *')
  async handleExpiredPoints(): Promise<void> {
    if (this.shuttingDown) return;
    if (this.activeRun) return this.activeRun;

    const run = this.runExpiredPointsCleanup();
    this.activeRun = run;
    try {
      await run;
    } finally {
      if (this.activeRun === run) this.activeRun = null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.shuttingDown = true;
    if (this.activeRun) await this.activeRun;
  }

  private async runExpiredPointsCleanup(): Promise<void> {
    const lockValue = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const acquired = await this.redisService.setNX(
      POINTS_EXPIRY_LOCK_KEY,
      lockValue,
      POINTS_EXPIRY_LOCK_TTL_SECONDS,
    );
    if (!acquired) return;

    try {
      // Shutdown can begin while SET NX is in flight. Do not start new database work after that.
      if (this.shuttingDown) return;
      const result = await this.pointsService.cleanExpiredPoints();
      const cleaned = Number((result as any)?.cleanedCount ?? 0);
      const deducted = Number((result as any)?.deductedPoints ?? 0);
      if (cleaned > 0 || deducted > 0) {
        this.logger.log(
          `积分自动过期清理完成: cleaned=${cleaned}, deducted=${deducted}`,
        );
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`积分自动过期清理失败：${err.message}`, err.stack);
    } finally {
      try {
        await this.redisService.releaseLockWithLua(POINTS_EXPIRY_LOCK_KEY, lockValue);
      } catch (error) {
        this.logger.warn(
          `释放积分过期清理锁失败：${(error as Error).message}`,
        );
      }
    }
  }
}
