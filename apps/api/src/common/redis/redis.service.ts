import { Inject, Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

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
    if (this.isSchedulerPaused(key)) {
      return false;
    }
    const result = await this.client.set(key, value, 'EX', ttlSeconds, 'NX');
    return result === 'OK';
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

  async releaseLockWithLua(key: string, value: string): Promise<boolean> {
    const lua = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;
    const result = await this.client.eval(lua, 1, key, value);
    return result === 1;
  }

  private isSchedulerPaused(key: string): boolean {
    if (!key.startsWith('schedule:')) return false;

    const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
    const markerPath = process.env.SCHEDULER_PAUSE_FILE || path.join(uploadDir, '.scheduler-paused');
    const paused = fs.existsSync(markerPath);
    if (paused && !this.schedulerPauseLogged) {
      this.schedulerPauseLogged = true;
      this.logger.warn(`检测到调度维护标记，Cron 任务暂停获取新锁：${markerPath}`);
    } else if (!paused && this.schedulerPauseLogged) {
      this.schedulerPauseLogged = false;
      this.logger.log('调度维护标记已解除，Cron 任务恢复获取新锁');
    }
    return paused;
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
        // The process is already shutting down; there is no further recovery action here.
      }
    }
  }
}
