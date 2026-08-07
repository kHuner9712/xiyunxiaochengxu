import { BadRequestException, Injectable, Logger } from '@nestjs/common';
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
    const configs = await this.prisma.systemConfig.findMany({ where: { groupName } });
    return configs.map((c) => ({ ...c, value: this.parseValue(c.configValue, c.valueType) }));
  }

  async findAll() {
    return this.prisma.systemConfig.findMany({ orderBy: { id: 'asc' } });
  }

  async findByGrouped() {
    const configs = await this.prisma.systemConfig.findMany({ orderBy: { id: 'asc' } });
    const grouped: Record<string, any> = {};
    for (const config of configs) {
      if (!grouped[config.groupName]) grouped[config.groupName] = {};
      grouped[config.groupName][config.configKey] = this.parseValue(config.configValue, config.valueType);
    }
    return grouped;
  }

  async getValue(groupName: string, configKey: string): Promise<string | null> {
    const cacheKey = `config:${groupName}:${configKey}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached !== null && cached !== undefined) return cached;

    const config = await this.prisma.systemConfig.findFirst({ where: { groupName, configKey } });
    if (!config) return null;
    await this.redisService.set(cacheKey, config.configValue || '', 3600);
    return config.configValue;
  }

  async getIntValue(groupName: string, configKey: string, fallback = 0): Promise<number> {
    const value = await this.getValue(groupName, configKey);
    if (value === null || value === '') return fallback;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  async getNumberValue(groupName: string, configKey: string, fallback: number): Promise<number> {
    const value = await this.getValue(groupName, configKey);
    if (value === null || value === '') return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  async update(groupName: string, configKey: string, configValue: string, valueType?: string) {
    const normalizedGroup = String(groupName || '').trim();
    const normalizedKey = String(configKey || '').trim();
    if (!normalizedGroup || !normalizedKey) throw new BadRequestException('配置分组和配置键不能为空');
    const normalizedValue = String(configValue ?? '');
    const result = await this.prisma.systemConfig.upsert({
      where: { uk_group_key: { groupName: normalizedGroup, configKey: normalizedKey } },
      update: { configValue: normalizedValue, ...(valueType ? { valueType } : {}) },
      create: {
        groupName: normalizedGroup,
        configKey: normalizedKey,
        configValue: normalizedValue,
        valueType: valueType || 'string',
      },
    });
    await this.redisService.set(`config:${normalizedGroup}:${normalizedKey}`, normalizedValue, 3600);
    this.logger.log(`更新配置：${normalizedGroup}.${normalizedKey}`);
    return result;
  }

  async batchUpdate(configs: { groupName: string; configKey: string; configValue: string; valueType?: string }[]) {
    if (!Array.isArray(configs) || configs.length === 0) throw new BadRequestException('系统配置不能为空');
    const normalized = configs.map((config) => {
      const groupName = String(config.groupName || '').trim();
      const configKey = String(config.configKey || '').trim();
      if (!groupName || !configKey) throw new BadRequestException('配置分组和配置键不能为空');
      return {
        groupName,
        configKey,
        configValue: String(config.configValue ?? ''),
        valueType: config.valueType || 'string',
      };
    });

    const results = await this.prisma.$transaction(async (tx) => {
      const rows = [];
      for (const config of normalized) {
        rows.push(await tx.systemConfig.upsert({
          where: { uk_group_key: { groupName: config.groupName, configKey: config.configKey } },
          update: { configValue: config.configValue, valueType: config.valueType },
          create: config,
        }));
      }
      return rows;
    });

    await Promise.all(normalized.map((config) =>
      this.redisService.set(`config:${config.groupName}:${config.configKey}`, config.configValue, 3600),
    ));
    this.logger.log(`批量更新配置，共${normalized.length}项`);
    return results;
  }

  async getCustomerServiceConfig() {
    const group = await this.findByGroup('customer_service');
    const configMap: Record<string, any> = {};
    for (const item of group) configMap[item.configKey] = item.value;
    const fallbackPhone = await this.getValue('basic', 'customer_service_phone');
    const phone = this.isPlaceholderContact(configMap.phone) ? '' : (configMap.phone ?? '');
    const basicPhone = this.isPlaceholderContact(fallbackPhone) ? '' : (fallbackPhone ?? '');
    return {
      enabled: configMap.enabled === 'true' || configMap.enabled === true,
      type: configMap.type ?? 'phone',
      phone: phone || basicPhone,
      wechatQrCode: configMap.wechatQrCode ?? '',
      serviceTime: configMap.serviceTime ?? '',
      autoReplyText: configMap.autoReplyText ?? '',
      faqContent: configMap.faqContent ?? '',
      notice: configMap.notice ?? '',
    };
  }

  async updateCustomerServiceConfig(dto: any) {
    const keys = ['enabled', 'type', 'phone', 'wechatQrCode', 'serviceTime', 'autoReplyText', 'faqContent', 'notice'];
    const configs = keys.map((key) => ({
      groupName: 'customer_service',
      configKey: key,
      configValue: String(dto[key] ?? ''),
      valueType: key === 'enabled' ? 'boolean' : 'string',
    }));
    await this.batchUpdate(configs);
    return this.getCustomerServiceConfig();
  }

  private isPlaceholderContact(value: unknown): boolean {
    if (typeof value !== 'string') return !value;
    const normalized = value.trim();
    if (!normalized) return true;
    return /x{3,}|待确认|暂定|placeholder|example/i.test(normalized);
  }

  private parseValue(value: string | null, type: string | null): any {
    if (value === null) return null;
    switch (type) {
      case 'number': return Number(value);
      case 'boolean': return value === 'true' || value === '1';
      case 'json':
        try { return JSON.parse(value); } catch { return value; }
      default: return value;
    }
  }
}
