import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { SystemConfigService } from './system-config.service';

@Injectable()
export class ResilientSystemConfigService extends SystemConfigService {
  constructor(
    private readonly resilientPrisma: PrismaService,
    private readonly resilientRedis: RedisService,
  ) {
    super(resilientPrisma, resilientRedis);
  }

  override async getValue(groupName: string, configKey: string): Promise<string | null> {
    // MySQL is the configuration ledger. Reading Redis first would allow an old cache entry to
    // become authoritative again after a transient Redis outage during a successful DB update.
    // Always resolve the durable row first, then repair the cache best-effort.
    const row = await this.resilientPrisma.systemConfig.findFirst({
      where: { groupName, configKey },
      select: { configValue: true },
    });
    const value = row?.configValue ?? null;
    const cacheKey = `config:${groupName}:${configKey}`;
    try {
      if (value === null) {
        await this.resilientRedis.del(cacheKey);
      } else {
        await this.resilientRedis.set(cacheKey, value, 3600);
      }
    } catch {
      // Redis is only an acceleration layer for system configuration. A cache outage must not
      // replace or hide the durable database value returned to business code.
    }
    return value;
  }

  override async update(
    groupName: string,
    configKey: string,
    configValue: string,
    valueType?: string,
  ) {
    try {
      return await super.update(groupName, configKey, configValue, valueType);
    } catch (error) {
      const row = await this.resilientPrisma.systemConfig.findFirst({
        where: { groupName, configKey },
      });
      if (!row || row.configValue !== String(configValue ?? '')) throw error;

      // The database commit succeeded and only a post-commit cache step failed. Reload the
      // in-memory snapshot from the database and report the durable write truthfully.
      await this.refreshRuntimeConfig();
      return row;
    }
  }

  override async batchUpdate(
    configs: { groupName: string; configKey: string; configValue: string; valueType?: string }[],
  ) {
    try {
      return await super.batchUpdate(configs);
    } catch (error) {
      if (!Array.isArray(configs) || configs.length === 0) throw error;
      const rows = await this.resilientPrisma.systemConfig.findMany({
        where: {
          OR: configs.map((config) => ({
            groupName: String(config.groupName || '').trim(),
            configKey: String(config.configKey || '').trim(),
          })),
        },
      });
      const durableValues = new Map(
        rows.map((row) => [`${row.groupName}\u0000${row.configKey}`, row.configValue]),
      );
      const allCommitted = configs.every((config) =>
        durableValues.get(`${String(config.groupName || '').trim()}\u0000${String(config.configKey || '').trim()}`)
          === String(config.configValue ?? ''),
      );
      if (!allCommitted) throw error;

      await this.refreshRuntimeConfig();
      return rows;
    }
  }
}
