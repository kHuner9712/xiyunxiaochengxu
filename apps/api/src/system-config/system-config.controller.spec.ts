import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { SystemConfigController } from './system-config.controller';

function createService() {
  return {
    findByGrouped: jest.fn() as any,
    findByGroup: jest.fn() as any,
    update: jest.fn() as any,
    batchUpdate: jest.fn() as any,
  };
}

describe('SystemConfigController storefront basic config validation', () => {
  let service: ReturnType<typeof createService>;
  let controller: SystemConfigController;

  beforeEach(() => {
    service = createService();
    controller = new SystemConfigController(service as any);
  });

  it('normalizes valid storefront basic config before forwarding to service', async () => {
    service.batchUpdate.mockResolvedValue([]);

    await controller.batchUpdate({
      configs: [
        { groupName: ' basic ', configKey: ' shop_name ', configValue: ' 禧孕优选 ', valueType: 'string' },
        { groupName: 'basic', configKey: 'shop_logo', configValue: ' /uploads/public/logo.png ', valueType: 'string' },
        { groupName: 'basic', configKey: 'customer_service_phone', configValue: ' 400-123-4567 ', valueType: 'string' },
      ],
    } as any);

    expect(service.batchUpdate).toHaveBeenCalledWith([
      { groupName: 'basic', configKey: 'shop_name', configValue: '禧孕优选', valueType: 'string' },
      { groupName: 'basic', configKey: 'shop_logo', configValue: '/uploads/public/logo.png', valueType: 'string' },
      { groupName: 'basic', configKey: 'customer_service_phone', configValue: '400-123-4567', valueType: 'string' },
    ]);
  });

  it('rejects empty or oversized storefront names before service writes', async () => {
    await expect(controller.update({
      groupName: 'basic',
      configKey: 'shop_name',
      configValue: '   ',
      valueType: 'string',
    } as any)).rejects.toBeInstanceOf(BadRequestException);

    await expect(controller.update({
      groupName: 'basic',
      configKey: 'shop_name',
      configValue: '店'.repeat(81),
      valueType: 'string',
    } as any)).rejects.toThrow('商城名称必须为1-80个字符');

    expect(service.update).not.toHaveBeenCalled();
  });

  it('rejects unsafe storefront logo protocols before service writes', async () => {
    await expect(controller.update({
      groupName: 'basic',
      configKey: 'shop_logo',
      configValue: 'javascript:alert(1)',
      valueType: 'string',
    } as any)).rejects.toThrow('商城Logo必须是合法站内路径或HTTP(S)地址');

    await expect(controller.update({
      groupName: 'basic',
      configKey: 'shop_logo',
      configValue: 'data:image/svg+xml;base64,AAAA',
      valueType: 'string',
    } as any)).rejects.toBeInstanceOf(BadRequestException);

    expect(service.update).not.toHaveBeenCalled();
  });

  it('accepts empty phone but rejects malformed non-empty phone', async () => {
    service.update.mockResolvedValue({});

    await controller.update({
      groupName: 'basic',
      configKey: 'customer_service_phone',
      configValue: ' ',
      valueType: 'string',
    } as any);
    expect(service.update).toHaveBeenLastCalledWith('basic', 'customer_service_phone', '', 'string');

    await expect(controller.update({
      groupName: 'basic',
      configKey: 'customer_service_phone',
      configValue: 'call-me-now',
      valueType: 'string',
    } as any)).rejects.toThrow('客服电话格式无效');
  });
});
