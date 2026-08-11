import { Inject, Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface RedisRuntimeSafetyConfig {
  maxmemoryPolicy: string;
  appendonly: string;
  appendfsync: string;
}

type SchedulerLockHeartbeat = {
  value: string;
  ttlSeconds: number;
  timer: ReturnType<typeof setTimeout> | null;
};

@Injectable()
export class RedisService implements OnApplicationShutdown {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: any;
  private closing = false;
  private schedulerPauseLogged = false;
  private readonly schedulerLockHeartbeats = new Map<string, SchedulerLockHeartbeat>();

  constructor(@Inject('REDIS_CLIENT') client: any) {
    this.client = client;
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async setNX(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    if (this.isSchedulerPaused(key)) {
      return false;
    }
    const result = await this.client.set(key, value, 'EX', ttlSeconds, 'NX');
    const acquired = result === 'OK';
    if (acquired && key.startsWith('schedule:')) {
      this.startSchedulerLockHeartbeat(key, value, ttlSeconds);
    }
    return acquired;
  }

  isSchedulerPausedForCurrentBuild(): boolean {
    return this.isSchedulerPaused('schedule:health-check');
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async delByPattern(pattern: string, scanCount = 200): Promise<number> {
    let cursor = '0';
    let deleted = 0;
    const count = Number.isInteger(scanCount) && scanCount > 0
      ? Math.min(scanCount, 1000)
      : 200;

    do {
      const result = await this.client.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        count,
      );
      cursor = String(result?.[0] ?? '0');
      const keys = Array.isArray(result?.[1]) ? result[1] : [];
      if (keys.length > 0) {
        deleted += Number(await this.client.del(...keys)) || 0;
      }
    } while (cursor !== '0');

    return deleted;
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async expire(key: string, seconds: number): Promise<void> {
    await this.client.expire(key, seconds);
  }

  async hset(key: string, field: string, value: string): Promise<void> {
    await this.client.hset(key, field, value);
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.client.hget(key, field);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return this.client.hgetall(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  async keys(pattern: string): Promise<string[]> {
    return this.client.keys(pattern);
  }

  async ping(): Promise<string> {
    return this.client.ping();
  }

  async getRuntimeSafetyConfig(): Promise<RedisRuntimeSafetyConfig> {
    const [maxmemoryPolicy, appendonly, appendfsync] = await Promise.all([
      this.getConfigValue('maxmemory-policy'),
      this.getConfigValue('appendonly'),
      this.getConfigValue('appendfsync'),
    ]);
    return { maxmemoryPolicy, appendonly, appendfsync };
  }

  async extendLockWithLua(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    const lua = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("expire", KEYS[1], ARGV[2]) else return 0 end`;
    const result = await this.client.eval(lua, 1, key, value, String(ttlSeconds));
    return result === 1;
  }

  async releaseLockWithLua(key: string, value: string): Promise<boolean> {
    const lua = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;
    try {
      const result = await this.client.eval(lua, 1, key, value);
      return result === 1;
    } finally {
      this.stopSchedulerLockHeartbeat(key, value);
    }
  }

  private startSchedulerLockHeartbeat(key: string, value: string, ttlSeconds: number): void {
    if (this.closing || ttlSeconds <= 0) return;

    this.stopSchedulerLockHeartbeat(key);
    const heartbeat: SchedulerLockHeartbeat = {
      value,
      ttlSeconds,
      timer: null,
    };
    this.schedulerLockHeartbeats.set(key, heartbeat);

    const delayMs = Math.max(100, Math.floor((ttlSeconds * 1000) / 3));
    const renew = async () => {
      if (this.closing || this.schedulerLockHeartbeats.get(key) !== heartbeat) return;

      try {
        const renewed = await this.extendLockWithLua(key, value, ttlSeconds);
        if (!renewed) {
          this.schedulerLockHeartbeats.delete(key);
          this.logger.error(`定时任务锁续租失败，已失去锁所有权：key=${key}`);
          return;
        }
      } catch (error) {
        this.logger.warn(`定时任务锁续租异常：key=${key}, error=${(error as Error).message}`);
      }

      if (this.closing || this.schedulerLockHeartbeats.get(key) !== heartbeat) return;
      heartbeat.timer = setTimeout(renew, delayMs);
      heartbeat.timer.unref?.();
    };

    heartbeat.timer = setTimeout(renew, delayMs);
    heartbeat.timer.unref?.();
  }

  private stopSchedulerLockHeartbeat(key: string, value?: string): void {
    const heartbeat = this.schedulerLockHeartbeats.get(key);
    if (!heartbeat || (value !== undefined && heartbeat.value !== value)) return;

    if (heartbeat.timer) clearTimeout(heartbeat.timer);
    this.schedulerLockHeartbeats.delete(key);
  }

  private stopAllSchedulerLockHeartbeats(): void {
    for (const heartbeat of this.schedulerLockHeartbeats.values()) {
      if (heartbeat.timer) clearTimeout(heartbeat.timer);
    }
    this.schedulerLockHeartbeats.clear();
  }

  private async getConfigValue(name: string): Promise<string> {
    const result = await this.client.config('GET', name);
    if (Array.isArray(result)) {
      return String(result[1] ?? '').trim().toLowerCase();
    }
    if (result && typeof result === 'object') {
      return String(result[name] ?? '').trim().toLowerCase();
    }
    return '';
  }

  private isSchedulerPaused(key: string): boolean {
    if (!key.startsWith('schedule:')) return false;

    const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
    const markerPath = process.env.SCHEDULER_PAUSE_FILE || path.join(uploadDir, '.scheduler-paused');
    if (!fs.existsSync(markerPath)) {
      if (this.schedulerPauseLogged) {
        this.schedulerPauseLogged = false;
        this.logger.log('调度维护标记已解除，Cron 任务恢复获取新锁');
      }
      return false;
    }

    let markerBuild = '';
    try {
      markerBuild = fs.readFileSync(markerPath, 'utf8').trim();
    } catch (error) {
      this.logger.warn(`调度维护标记不可读，按暂停处理：${(error as Error).message}`);
      return true;
    }

    const currentBuild = String(process.env.BUILD_SHA || '').trim();
    const paused = !markerBuild
      || markerBuild === '*'
      || !currentBuild
      || currentBuild === 'unknown'
      || markerBuild === currentBuild;

    if (paused && !this.schedulerPauseLogged) {
      this.schedulerPauseLogged = true;
      this.logger.warn(`检测到当前构建的调度维护标记，Cron 任务暂停获取新锁：${markerPath}`);
    } else if (!paused && this.schedulerPauseLogged) {
      this.schedulerPauseLogged = false;
      this.logger.log('调度维护标记属于其他构建，当前 Cron 正常运行');
    }
    return paused;
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.closing || !this.client) return;
    this.closing = true;
    this.stopAllSchedulerLockHeartbeats();

    const status = String(this.client.status || '');
    if (status === 'end' || status === 'close') return;

    try {
      if (typeof this.client.quit === 'function') {
        await this.client.quit();
      } else if (typeof this.client.disconnect === 'function') {
        this.client.disconnect();
      }
    } catch (error: any) {
      this.logger.warn(`Redis graceful shutdown failed, forcing disconnect: ${error?.message || error}`);
      try {
        this.client.disconnect?.();
      } catch {
      }
    }
  }
}