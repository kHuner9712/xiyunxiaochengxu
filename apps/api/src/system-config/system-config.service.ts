import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  AFTERSALE_APPLY_DAYS,
  FREIGHT_DEFAULT_FEE,
  FREIGHT_FREE_AMOUNT,
  ORDER_AUTO_CLOSE_MINUTES,
  ORDER_AUTO_COMPLETE_DAYS,
  POINTS_DEDUCT_MAX_PERCENT,
  POINTS_DEDUCT_RATE,
} from '@baby-mall/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';

export type RuntimeBusinessConfig = {
  orderAutoCloseMinutes: number;
  orderAutoCompleteDays: number;
  aftersaleApplyDays: number;
  defaultFreight: number;
  freeShippingAmount: number;
  pointsDeductRate: number;
  pointsDeductMaxPercent: number;
};

export type CustomerServiceConfigInput = {
  enabled: string;
  type: string;
  phone: string;
  wechatQrCode: string;
  serviceTime: string;
  autoReplyText: string;
  faqContent: string;
  notice: string;
};

type CustomerFaqItem = {
  question: string;
  answer: string;
};

const DEFAULT_RUNTIME_CONFIG: RuntimeBusinessConfig = {
  orderAutoCloseMinutes: ORDER_AUTO_CLOSE_MINUTES,
  orderAutoCompleteDays: ORDER_AUTO_COMPLETE_DAYS,
  aftersaleApplyDays: AFTERSALE_APPLY_DAYS,
  defaultFreight: FREIGHT_DEFAULT_FEE,
  freeShippingAmount: FREIGHT_FREE_AMOUNT,
  pointsDeductRate: POINTS_DEDUCT_RATE,
  pointsDeductMaxPercent: POINTS_DEDUCT_MAX_PERCENT,
};

const CUSTOMER_SERVICE_TYPES = new Set(['phone', 'wechat', 'both']);
const MAX_CUSTOMER_FAQS = 50;

@Injectable()
export class SystemConfigService implements OnModuleInit {
  private readonly logger = new Logger(SystemConfigService.name);
  private runtimeConfig: RuntimeBusinessConfig = { ...DEFAULT_RUNTIME_CONFIG };

  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {}

  async onModuleInit() {
    try {
      await this.refreshRuntimeConfig();
    } catch (error) {
      this.logger.error(`加载运行时业务配置失败，使用安全默认值：${(error as Error).message}`);
    }
  }

  getRuntimeConfig(): RuntimeBusinessConfig {
    return { ...this.runtimeConfig };
  }

  async refreshRuntimeConfig() {
    const configs = await this.prisma.systemConfig.findMany({
      where: {
        OR: [
          { groupName: 'payment', configKey: 'order_auto_close_minutes' },
          { groupName: 'logistics', configKey: 'order_auto_complete_days' },
          { groupName: 'order', configKey: 'aftersale_apply_days' },
          { groupName: 'logistics', configKey: 'default_freight' },
          { groupName: 'logistics', configKey: 'free_shipping_amount' },
          { groupName: 'points', configKey: 'points_deduct_rate' },
          { groupName: 'points', configKey: 'points_deduct_max_percent' },
        ],
      },
    });
    const next = { ...DEFAULT_RUNTIME_CONFIG };
    for (const config of configs) {
      this.applyRuntimeConfigValue(next, config.groupName, config.configKey, config.configValue);
    }
    this.runtimeConfig = next;
    return this.getRuntimeConfig();
  }

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
    this.validateRuntimeConfigValue(normalizedGroup, normalizedKey, normalizedValue);

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
    this.applyRuntimeConfigValue(this.runtimeConfig, normalizedGroup, normalizedKey, normalizedValue);
    this.logger.log(`更新配置：${normalizedGroup}.${normalizedKey}`);
    return result;
  }

  async batchUpdate(configs: { groupName: string; configKey: string; configValue: string; valueType?: string }[]) {
    if (!Array.isArray(configs) || configs.length === 0) throw new BadRequestException('系统配置不能为空');
    const normalized = configs.map((config) => {
      const groupName = String(config.groupName || '').trim();
      const configKey = String(config.configKey || '').trim();
      if (!groupName || !configKey) throw new BadRequestException('配置分组和配置键不能为空');
      const configValue = String(config.configValue ?? '');
      this.validateRuntimeConfigValue(groupName, configKey, configValue);
      return {
        groupName,
        configKey,
        configValue,
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
    const next = { ...this.runtimeConfig };
    for (const config of normalized) {
      this.applyRuntimeConfigValue(next, config.groupName, config.configKey, config.configValue);
    }
    this.runtimeConfig = next;
    this.logger.log(`批量更新配置，共${normalized.length}项`);
    return results;
  }

  async getCustomerServiceConfig() {
    const group = await this.findByGroup('customer_service');
    const configMap: Record<string, any> = {};
    for (const item of group) configMap[item.configKey] = item.value;
    const fallbackPhone = await this.getValue('basic', 'customer_service_phone');
    const phone = this.isPlaceholderContact(configMap.phone) ? '' : String(configMap.phone ?? '').trim();
    const basicPhone = this.isPlaceholderContact(fallbackPhone) ? '' : String(fallbackPhone ?? '').trim();
    const type = CUSTOMER_SERVICE_TYPES.has(String(configMap.type || '')) ? String(configMap.type) : 'phone';
    return {
      enabled: configMap.enabled === 'true' || configMap.enabled === true,
      type,
      phone: phone || basicPhone,
      wechatQrCode: String(configMap.wechatQrCode ?? '').trim(),
      serviceTime: String(configMap.serviceTime ?? '').trim(),
      autoReplyText: String(configMap.autoReplyText ?? '').trim(),
      faqContent: this.normalizeCustomerFaq(configMap.faqContent, false),
      notice: String(configMap.notice ?? '').trim(),
    };
  }

  async updateCustomerServiceConfig(dto: CustomerServiceConfigInput) {
    const enabled = String(dto.enabled) === 'true';
    const type = String(dto.type || '').trim();
    if (!CUSTOMER_SERVICE_TYPES.has(type)) throw new BadRequestException('客服类型无效');

    const phone = String(dto.phone || '').trim();
    const wechatQrCode = String(dto.wechatQrCode || '').trim();
    const serviceTime = String(dto.serviceTime || '').trim();
    const autoReplyText = String(dto.autoReplyText || '').trim();
    const notice = String(dto.notice || '').trim();
    if (enabled && (type === 'phone' || type === 'both') && this.isPlaceholderContact(phone)) {
      throw new BadRequestException('启用电话客服时必须填写有效客服电话');
    }
    const faqContent = this.normalizeCustomerFaq(dto.faqContent, true);

    const normalized: Record<string, string> = {
      enabled: String(enabled),
      type,
      phone,
      wechatQrCode,
      serviceTime,
      autoReplyText,
      faqContent,
      notice,
    };
    const keys = ['enabled', 'type', 'phone', 'wechatQrCode', 'serviceTime', 'autoReplyText', 'faqContent', 'notice'];
    const configs = keys.map((key) => ({
      groupName: 'customer_service',
      configKey: key,
      configValue: normalized[key],
      valueType: key === 'enabled' ? 'boolean' : 'string',
    }));
    await this.batchUpdate(configs);
    return this.getCustomerServiceConfig();
  }

  private normalizeCustomerFaq(rawValue: unknown, strict: boolean): string {
    const source = typeof rawValue === 'string' ? rawValue.trim() : '';
    if (!source) return '[]';

    let parsed: unknown;
    try {
      parsed = JSON.parse(source);
    } catch {
      if (strict) throw new BadRequestException('常见问题内容不是合法JSON');
      return '[]';
    }
    if (!Array.isArray(parsed)) {
      if (strict) throw new BadRequestException('常见问题必须是数组');
      return '[]';
    }
    const parsedItems: unknown[] = parsed;
    if (parsedItems.length > MAX_CUSTOMER_FAQS && strict) {
      throw new BadRequestException(`常见问题最多${MAX_CUSTOMER_FAQS}条`);
    }
    const faqItems = parsedItems.slice(0, MAX_CUSTOMER_FAQS);

    const normalized: CustomerFaqItem[] = [];
    for (const [index, item] of faqItems.entries()) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        if (strict) throw new BadRequestException(`第${index + 1}条常见问题格式无效`);
        continue;
      }
      const record = item as Record<string, unknown>;
      const question = String(record.question ?? '').trim();
      const answer = String(record.answer ?? '').trim();
      if (!question || !answer || question.length > 200 || answer.length > 2000) {
        if (strict) throw new BadRequestException(`第${index + 1}条常见问题的问答内容无效`);
        continue;
      }
      normalized.push({ question, answer });
    }
    return JSON.stringify(normalized);
  }

  private validateRuntimeConfigValue(groupName: string, configKey: string, rawValue: string) {
    const key = `${groupName}.${configKey}`;
    const value = Number(rawValue);
    const requireIntegerRange = (min: number, max: number, label: string) => {
      if (!Number.isSafeInteger(value) || value < min || value > max) {
        throw new BadRequestException(`${label}必须为${min}-${max}之间的整数`);
      }
    };
    switch (key) {
      case 'payment.order_auto_close_minutes':
        requireIntegerRange(5, 1440, '自动取消时间');
        break;
      case 'logistics.order_auto_complete_days':
        requireIntegerRange(1, 365, '自动确认收货天数');
        break;
      case 'order.aftersale_apply_days':
        requireIntegerRange(1, 365, '售后申请期限');
        break;
      case 'logistics.default_freight':
        requireIntegerRange(0, 10000000, '默认运费');
        break;
      case 'logistics.free_shipping_amount':
        requireIntegerRange(0, 1000000000, '满额包邮金额');
        break;
      case 'points.points_deduct_rate':
        requireIntegerRange(1, 1000000, '积分抵扣比率');
        break;
      case 'points.points_deduct_max_percent':
        requireIntegerRange(0, 100, '积分抵扣上限');
        break;
      default:
        break;
    }
  }

  private applyRuntimeConfigValue(
    target: RuntimeBusinessConfig,
    groupName: string,
    configKey: string,
    rawValue: string | null,
  ) {
    if (rawValue === null || rawValue.trim() === '') return;
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return;
    switch (`${groupName}.${configKey}`) {
      case 'payment.order_auto_close_minutes':
        if (Number.isSafeInteger(value) && value >= 5 && value <= 1440) target.orderAutoCloseMinutes = value;
        break;
      case 'logistics.order_auto_complete_days':
        if (Number.isSafeInteger(value) && value >= 1 && value <= 365) target.orderAutoCompleteDays = value;
        break;
      case 'order.aftersale_apply_days':
        if (Number.isSafeInteger(value) && value >= 1 && value <= 365) target.aftersaleApplyDays = value;
        break;
      case 'logistics.default_freight':
        if (Number.isSafeInteger(value) && value >= 0) target.defaultFreight = value;
        break;
      case 'logistics.free_shipping_amount':
        if (Number.isSafeInteger(value) && value >= 0) target.freeShippingAmount = value;
        break;
      case 'points.points_deduct_rate':
        if (Number.isSafeInteger(value) && value >= 1) target.pointsDeductRate = value;
        break;
      case 'points.points_deduct_max_percent':
        if (Number.isSafeInteger(value) && value >= 0 && value <= 100) target.pointsDeductMaxPercent = value;
        break;
      default:
        break;
    }
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
