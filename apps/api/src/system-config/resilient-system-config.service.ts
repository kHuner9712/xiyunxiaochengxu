import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { SystemConfigService } from './system-config.service';

@Injectable()
export class ResilientSystemConfigService extends SystemConfigService {
  constructor(
    private readonly resilientPrisma: PrismaService,
    redisService: RedisService,
  ) {
    super(resilientPrisma, redisService);
  }

  override async getValue(groupName: string, configKey: string): Promise<string | null> {
    try {
      return await super.getValue(groupName, configKey);
    } catch {
      // Runtime business rules must remain readable from the source-of-truth database even if
      // Redis is temporarily unavailable. Redis is a cache here, not the configuration ledger.
      const row = await this.resilientPrisma.systemConfig.findFirst({
        where: { groupName, configKey },
        select: { configValue: true },
      });
      return row?.configValue ?? null;
    }
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

      // The database commit succeeded and only a post-commit cache/runtime step failed. Reload
      // the in-memory snapshot from the database and report the durable write truthfully.
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
