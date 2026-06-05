import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { SystemConfigService } from './system-config.service';

function createMockPrisma() {
  return {
    systemConfig: {
      findMany: jest.fn() as any,
      findFirst: jest.fn() as any,
      upsert: jest.fn() as any,
    },
  };
}

function createMockRedis() {
  return {
    get: jest.fn() as any,
    set: jest.fn() as any,
  };
}

describe('SystemConfigService - CustomerService', () => {
  let service: SystemConfigService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let redis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    prisma = createMockPrisma();
    redis = createMockRedis();
    service = new SystemConfigService(prisma as any, redis as any);
    jest.spyOn(service['logger'], 'log').mockImplementation(() => {});
  });

  describe('getCustomerServiceConfig', () => {
    it('should return default values when no config exists', async () => {
      prisma.systemConfig.findMany.mockResolvedValue([]);

      const result = await service.getCustomerServiceConfig();

      expect(result.enabled).toBe(false);
      expect(result.type).toBe('phone');
      expect(result.phone).toBe('');
      expect(result.wechatQrCode).toBe('');
      expect(result.serviceTime).toBe('');
      expect(result.autoReplyText).toBe('');
      expect(result.faqContent).toBe('');
      expect(result.notice).toBe('');
    });

    it('should return configured values', async () => {
      prisma.systemConfig.findMany.mockResolvedValue([
        { groupName: 'customer_service', configKey: 'enabled', configValue: 'true', valueType: 'boolean' },
        { groupName: 'customer_service', configKey: 'type', configValue: 'both', valueType: 'string' },
        { groupName: 'customer_service', configKey: 'phone', configValue: '400-123-4567', valueType: 'string' },
        { groupName: 'customer_service', configKey: 'wechatQrCode', configValue: 'https://example.com/qr.png', valueType: 'string' },
        { groupName: 'customer_service', configKey: 'serviceTime', configValue: '9:00-18:00', valueType: 'string' },
        { groupName: 'customer_service', configKey: 'autoReplyText', configValue: '请稍候', valueType: 'string' },
        { groupName: 'customer_service', configKey: 'faqContent', configValue: '[]', valueType: 'json' },
        { groupName: 'customer_service', configKey: 'notice', configValue: '公告', valueType: 'string' },
      ]);

      const result = await service.getCustomerServiceConfig();

      expect(result.enabled).toBe(true);
      expect(result.type).toBe('both');
      expect(result.phone).toBe('400-123-4567');
      expect(result.wechatQrCode).toBe('https://example.com/qr.png');
      expect(result.serviceTime).toBe('9:00-18:00');
      expect(result.autoReplyText).toBe('请稍候');
      expect(result.notice).toBe('公告');
    });

    it('should fallback to basic customer_service_phone when customer_service phone is empty', async () => {
      prisma.systemConfig.findMany.mockResolvedValue([
        { groupName: 'customer_service', configKey: 'enabled', configValue: 'true', valueType: 'boolean' },
        { groupName: 'customer_service', configKey: 'type', configValue: 'phone', valueType: 'string' },
        { groupName: 'customer_service', configKey: 'phone', configValue: '', valueType: 'string' },
      ]);
      redis.get.mockResolvedValue('');
      prisma.systemConfig.findFirst.mockResolvedValue({
        groupName: 'basic',
        configKey: 'customer_service_phone',
        configValue: '400-123-4567',
        valueType: 'string',
      });

      const result = await service.getCustomerServiceConfig();

      expect(result.phone).toBe('400-123-4567');
    });

    it('should not expose placeholder customer service phone', async () => {
      prisma.systemConfig.findMany.mockResolvedValue([
        { groupName: 'customer_service', configKey: 'enabled', configValue: 'true', valueType: 'boolean' },
        { groupName: 'customer_service', configKey: 'type', configValue: 'phone', valueType: 'string' },
        { groupName: 'customer_service', configKey: 'phone', configValue: '400-XXX-XXXX', valueType: 'string' },
      ]);
      redis.get.mockResolvedValue('');
      prisma.systemConfig.findFirst.mockResolvedValue(null);

      const result = await service.getCustomerServiceConfig();

      expect(result.phone).toBe('');
    });
  });

  describe('updateCustomerServiceConfig', () => {
    it('should batch update all customer_service config keys', async () => {
      prisma.systemConfig.upsert.mockResolvedValue({});

      const dto = {
        enabled: 'true',
        type: 'wechat',
        phone: '400-999-8888',
        wechatQrCode: '',
        serviceTime: '9:00-21:00',
        autoReplyText: '您好',
        faqContent: '[{"question":"Q1","answer":"A1"}]',
        notice: '测试公告',
      };

      await service.updateCustomerServiceConfig(dto);

      expect(prisma.systemConfig.upsert).toHaveBeenCalledTimes(8);
      expect(prisma.systemConfig.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { uk_group_key: { groupName: 'customer_service', configKey: 'enabled' } },
          update: { configValue: 'true' },
          create: { groupName: 'customer_service', configKey: 'enabled', configValue: 'true' },
        })
      );
    });
  });
});
