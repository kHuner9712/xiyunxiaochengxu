import { Inject, Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface RedisRuntimeSafetyConfig {
  maxmemoryPolicy: string;
  appendonly: string;
  appendfsync: string;
}

@Injectable()
export class RedisService implements OnApplicationShutdown {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: any;
  private closing = false;
  private schedulerPauseLogged = false;

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
    const schedulerLock = key.startsWith('schedule:');
    if (schedulerLock && this.isSchedulerPaused(key)) {
      return false;
    }

    const result = await this.client.set(key, value, 'EX', ttlSeconds, 'NX');
    if (result !== 'OK') return false;

    // A migration can publish the shared maintenance marker while Redis SET NX is in flight.
    // Re-check after acquisition so an old API instance cannot enter a new Cron critical section
    // in that narrow race. Release only the token we just acquired; if release itself is
    // temporarily unavailable, return false anyway and let the short Redis lease expire naturally.
    if (schedulerLock && this.isSchedulerPaused(key)) {
      try {
        await this.releaseLockWithLua(key, value);
      } catch (error) {
        this.logger.warn(
          `调度维护模式下释放刚获取的 Cron 锁失败：key=${key}, error=${(error as Error).message}`,
        );
      }
      return false;
    }

    return true;
  }

  /**
   * Compatibility probe used by health/preflight code. The pause marker is intentionally global:
   * a migration image writes its own BUILD_SHA into a shared volume, but every currently running
   * API build must stop starting new Cron work while that marker exists.
   */
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

  async releaseLockWithLua(key: string, value: string): Promise<boolean> {
    const lua = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;
    const result = await this.client.eval(lua, 1, key, value);
    return result === 1;
  }

  async extendLockWithLua(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
      throw new Error('Redis lock TTL must be a positive integer');
    }
    const lua = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("expire", KEYS[1], ARGV[2]) else return 0 end`;
    const result = await this.client.eval(
      lua,
      1,
      key,
      value,
      String(ttlSeconds),
    );
    return result === 1;
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
      this.logger.warn(`调度维护标记不可读，按全局暂停处理：${(error as Error).message}`);
      return true;
    }

    if (!this.schedulerPauseLogged) {
      this.schedulerPauseLogged = true;
      const currentBuild = String(process.env.BUILD_SHA || 'unknown').trim() || 'unknown';
      this.logger.warn(
        `检测到全局调度维护标记，所有构建暂停获取新 Cron 锁：markerBuild=${markerBuild || 'unknown'}, currentBuild=${currentBuild}, path=${markerPath}`,
      );
    }
    return true;
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.closing || !this.client) return;
    this.closing = true;

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
