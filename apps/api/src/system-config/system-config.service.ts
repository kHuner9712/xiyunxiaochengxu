import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';

@Injectable()
export class SystemConfigService {
  private readonly logger = new Logger(SystemConfigService.name);

  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {}

  async findByGroup(groupName: string) {
    const configs = await this.prisma.systemConfig.findMany({
      where: { groupName },
    });
    return configs.map((c) => ({
      ...c,
      value: this.parseValue(c.configValue, c.valueType),
    }));
  }

  async findAll() {
    return this.prisma.systemConfig.findMany();
  }

  async findByGrouped() {
    const configs = await this.prisma.systemConfig.findMany();
    const grouped: Record<string, any> = {};
    for (const config of configs) {
      if (!grouped[config.groupName]) {
        grouped[config.groupName] = {};
      }
      grouped[config.groupName][config.configKey] = this.parseValue(config.configValue, config.valueType);
    }
    return grouped;
  }

  async getValue(groupName: string, configKey: string): Promise<string | null> {
    const cacheKey = `config:${groupName}:${configKey}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) return cached;

    const config = await this.prisma.systemConfig.findFirst({
      where: { groupName, configKey },
    });

    if (!config) return null;

    await this.redisService.set(cacheKey, config.configValue || '', 3600);
    return config.configValue;
  }

  async getIntValue(groupName: string, configKey: string): Promise<number> {
    const value = await this.getValue(groupName, configKey);
    return value ? parseInt(value, 10) : 0;
  }

  async update(groupName: string, configKey: string, configValue: string) {
    const result = await this.prisma.systemConfig.upsert({
      where: { uk_group_key: { groupName, configKey } },
      update: { configValue },
      create: { groupName, configKey, configValue },
    });

    const cacheKey = `config:${groupName}:${configKey}`;
    await this.redisService.set(cacheKey, configValue, 3600);

    this.logger.log(`更新配置：${groupName}.${configKey} = ${configValue}`);
    return result;
  }

  async batchUpdate(configs: { groupName: string; configKey: string; configValue: string }[]) {
    const results = [];
    for (const config of configs) {
      results.push(await this.update(config.groupName, config.configKey, config.configValue));
    }
    this.logger.log(`批量更新配置，共${configs.length}项`);
    return results;
  }

  async getCustomerServiceConfig() {
    const group = await this.findByGroup('customer_service');
    const configMap: Record<string, any> = {};
    for (const item of group) {
      configMap[item.configKey] = item.value;
    }
    return {
      enabled: configMap.enabled === 'true' || configMap.enabled === true,
      type: configMap.type ?? 'phone',
      phone: configMap.phone ?? '',
      wechatQrCode: configMap.wechatQrCode ?? '',
      serviceTime: configMap.serviceTime ?? '',
      autoReplyText: configMap.autoReplyText ?? '',
      faqContent: configMap.faqContent ?? '',
      notice: configMap.notice ?? '',
    };
  }

  async updateCustomerServiceConfig(dto: any) {
    const keys = ['enabled', 'type', 'phone', 'wechatQrCode', 'serviceTime', 'autoReplyText', 'faqContent', 'notice'];
    const configs = keys.map(key => ({
      groupName: 'customer_service',
      configKey: key,
      configValue: String(dto[key] ?? ''),
    }));
    return this.batchUpdate(configs);
  }

  private parseValue(value: string | null, type: string | null): any {
    if (value === null) return null;
    switch (type) {
      case 'number':
        return Number(value);
      case 'boolean':
        return value === 'true' || value === '1';
      case 'json':
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      default:
        return value;
    }
  }
}
