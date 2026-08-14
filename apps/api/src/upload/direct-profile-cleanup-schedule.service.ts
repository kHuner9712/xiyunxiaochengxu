import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RedisService } from '../common/redis/redis.service';
import { DirectProfileAccountCleanupService } from './direct-profile-account-cleanup.service';

const DIRECT_PROFILE_CLEANUP_LOCK_KEY = 'schedule:direct_profile_cancelled_cleanup';
const DIRECT_PROFILE_CLEANUP_LOCK_TTL_SECONDS = 1800;

@Injectable()
export class DirectProfileCleanupScheduleService implements OnModuleDestroy {
  private readonly logger = new Logger(DirectProfileCleanupScheduleService.name);
  private shuttingDown = false;
  private activeRun: Promise<void> | null = null;

  constructor(
    private readonly redisService: RedisService,
    private readonly cleanupService: DirectProfileAccountCleanupService,
  ) {}

  @Cron('0 23 * * * *')
  async handleCancelledProfileAssets(): Promise<void> {
    if (this.shuttingDown) return;
    if (this.activeRun) return this.activeRun;

    const run = this.runCleanup();
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

  private async runCleanup(): Promise<void> {
    const lockValue = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const acquired = await this.redisService.setNX(
      DIRECT_PROFILE_CLEANUP_LOCK_KEY,
      lockValue,
      DIRECT_PROFILE_CLEANUP_LOCK_TTL_SECONDS,
    );
    if (!acquired) return;

    try {
      if (this.shuttingDown) return;
      const result = await this.cleanupService.cleanupCancelledAccountsBatch(200);
      if (result.failed.length > 0) {
        this.logger.error(
          `已注销账号直接资料图片补偿清理存在失败: scanned=${result.scanned}, deleted=${result.deleted}, failed=${result.failed.join(',')}`,
        );
      } else if (result.deleted > 0) {
        this.logger.log(
          `已注销账号直接资料图片补偿清理完成: scanned=${result.scanned}, deleted=${result.deleted}`,
        );
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`已注销账号直接资料图片补偿清理任务失败：${err.message}`, err.stack);
    } finally {
      try {
        await this.redisService.releaseLockWithLua(
          DIRECT_PROFILE_CLEANUP_LOCK_KEY,
          lockValue,
        );
      } catch (error) {
        this.logger.warn(
          `释放直接资料图片清理锁失败：${(error as Error).message}`,
        );
      }
    }
  }
}
