import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RedisService } from '../common/redis/redis.service';
import { AtomicMemberService } from './atomic-member.service';
import { MemberService } from './member.service';

const MEMBER_LEVEL_RECONCILE_LOCK_KEY = 'schedule:member_level_reconcile';
const MEMBER_LEVEL_RECONCILE_LOCK_TTL_SECONDS = 120;
const MEMBER_LEVEL_RECONCILE_MAX_BATCHES = 20;

@Injectable()
export class MemberLevelReconcileScheduleService implements OnModuleDestroy {
  private readonly logger = new Logger(MemberLevelReconcileScheduleService.name);
  private shuttingDown = false;
  private activeRun: Promise<void> | null = null;

  constructor(
    private readonly redisService: RedisService,
    @Inject(MemberService)
    private readonly memberService: AtomicMemberService,
  ) {}

  async onModuleDestroy(): Promise<void> {
    this.shuttingDown = true;
    if (this.activeRun) await this.activeRun;
  }

  @Cron('20 * * * * *')
  async handleMemberLevelReconcile(): Promise<void> {
    if (this.shuttingDown || this.activeRun) return;

    const run = this.runOnce();
    this.activeRun = run;
    try {
      await run;
    } finally {
      if (this.activeRun === run) this.activeRun = null;
    }
  }

  private async runOnce(): Promise<void> {
    const lockValue = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let acquired = false;
    let heartbeat: ReturnType<typeof setInterval> | null = null;

    try {
      acquired = await this.redisService.setNX(
        MEMBER_LEVEL_RECONCILE_LOCK_KEY,
        lockValue,
        MEMBER_LEVEL_RECONCILE_LOCK_TTL_SECONDS,
      );
      if (!acquired || this.shuttingDown) return;

      const heartbeatMs = Math.floor(MEMBER_LEVEL_RECONCILE_LOCK_TTL_SECONDS * 1000 / 3);
      heartbeat = setInterval(() => {
        void this.redisService
          .extendLockWithLua(
            MEMBER_LEVEL_RECONCILE_LOCK_KEY,
            lockValue,
            MEMBER_LEVEL_RECONCILE_LOCK_TTL_SECONDS,
          )
          .then((renewed) => {
            if (!renewed) {
              this.logger.error('会员等级重算定时任务锁续租失败，锁所有权已丢失');
            }
          })
          .catch((error) => {
            this.logger.error(`会员等级重算定时任务锁续租异常：${(error as Error).message}`);
          });
      }, heartbeatMs);
      heartbeat.unref?.();

      const result = await this.memberService.reconcilePendingLevelConfiguration(
        MEMBER_LEVEL_RECONCILE_MAX_BATCHES,
      );
      if (result.status === 'pending') {
        this.logger.log(
          `会员等级重算仍有待处理用户：generation=${result.generationId}, batches=${result.batches}, scanned=${result.scanned}, updated=${result.updated}`,
        );
      } else if (result.status === 'completed' && result.updated > 0) {
        this.logger.log(
          `会员等级重算补偿完成：generation=${result.generationId}, scanned=${result.scanned}, updated=${result.updated}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `会员等级重算补偿失败：${(error as Error).message}`,
        (error as Error).stack,
      );
    } finally {
      if (heartbeat) clearInterval(heartbeat);
      if (acquired) {
        try {
          await this.redisService.releaseLockWithLua(
            MEMBER_LEVEL_RECONCILE_LOCK_KEY,
            lockValue,
          );
        } catch (error) {
          this.logger.warn(`释放会员等级重算锁失败：${(error as Error).message}`);
        }
      }
    }
  }
}
