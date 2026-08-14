import { BadRequestException } from '@nestjs/common';
import { ResilientSystemConfigService } from './resilient-system-config.service';

function fixture() {
  const saved = new Map<string, any>();
  const systemConfig: any = {
    findFirst: jest.fn(async ({ where }: any) => saved.get(`${where.groupName}.${where.configKey}`) || null),
    findMany: jest.fn(async ({ where }: any = {}) => {
      const rows = Array.from(saved.values());
      if (!where?.OR) return rows;
      return rows.filter((row: any) => where.OR.some((item: any) => item.groupName === row.groupName && item.configKey === row.configKey));
    }),
    upsert: jest.fn(async ({ where, update, create }: any) => {
      const key = `${where.uk_group_key.groupName}.${where.uk_group_key.configKey}`;
      const current = saved.get(key);
      const row = current ? { ...current, ...update } : { id: BigInt(saved.size + 1), ...create };
      saved.set(key, row);
      return row;
    }),
  };
  const prisma: any = {
    systemConfig,
    $transaction: jest.fn(async (callback: any) => callback({ systemConfig })),
  };
  const redis: any = {
    get: jest.fn().mockRejectedValue(new Error('redis down')),
    set: jest.fn().mockRejectedValue(new Error('redis down')),
    del: jest.fn().mockRejectedValue(new Error('redis down')),
  };
  return { service: new ResilientSystemConfigService(prisma, redis), prisma, redis, saved };
}

describe('ResilientSystemConfigService', () => {
  it('uses the durable database value when Redis is unavailable', async () => {
    const { service, saved } = fixture();
    saved.set('basic.shop_name', {
      id: 1n,
      groupName: 'basic',
      configKey: 'shop_name',
      configValue: '禧孕优选',
      valueType: 'string',
    });

    await expect(service.getValue('basic', 'shop_name')).resolves.toBe('禧孕优选');
  });

  it('never lets a stale recovered Redis value override the durable database value', async () => {
    const { service, saved, redis } = fixture();
    saved.set('basic.customer_service_phone', {
      id: 1n,
      groupName: 'basic',
      configKey: 'customer_service_phone',
      configValue: '400-800-2026',
      valueType: 'string',
    });
    redis.get.mockResolvedValue('400-OLD-CACHE');
    redis.set.mockResolvedValue(undefined);

    await expect(service.getValue('basic', 'customer_service_phone')).resolves.toBe('400-800-2026');
    expect(redis.get).not.toHaveBeenCalled();
    expect(redis.set).toHaveBeenCalledWith(
      'config:basic:customer_service_phone',
      '400-800-2026',
      3600,
    );
  });

  it('removes a stale cache entry when the durable configuration row no longer exists', async () => {
    const { service, redis } = fixture();
    redis.del.mockResolvedValue(undefined);

    await expect(service.getValue('basic.removed', 'missing')).resolves.toBeNull();
    expect(redis.del).toHaveBeenCalledWith('config:basic.removed:missing');
  });

  it('commits batch settings and refreshes runtime rules even when cache writes fail', async () => {
    const { service } = fixture();

    await expect(service.batchUpdate([
      { groupName: 'payment', configKey: 'order_auto_close_minutes', configValue: '15', valueType: 'number' },
      { groupName: 'points', configKey: 'points_deduct_rate', configValue: '200', valueType: 'number' },
      { groupName: 'points', configKey: 'points_deduct_max_percent', configValue: '20', valueType: 'number' },
    ])).resolves.toHaveLength(3);

    expect(service.getRuntimeConfig()).toEqual(expect.objectContaining({
      orderAutoCloseMinutes: 15,
      pointsDeductRate: 200,
      pointsDeductMaxPercent: 20,
    }));
  });

  it('rejects invalid runtime values before touching the database', async () => {
    const { service, prisma } = fixture();

    await expect(service.update('payment', 'order_auto_close_minutes', '1', 'number'))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.systemConfig.upsert).not.toHaveBeenCalled();
  });
});
