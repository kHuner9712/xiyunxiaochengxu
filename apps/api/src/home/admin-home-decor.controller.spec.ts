import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AdminHomeDecorController } from './admin-home-decor.controller';

function createMockPrisma() {
  return {
    systemConfig: {
      findFirst: jest.fn() as any,
      upsert: jest.fn() as any,
    },
  };
}

function createMockRedis() {
  return {
    del: jest.fn() as any,
  };
}

describe('AdminHomeDecorController', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let redis: ReturnType<typeof createMockRedis>;
  let controller: AdminHomeDecorController;

  beforeEach(() => {
    prisma = createMockPrisma();
    redis = createMockRedis();
    redis.del.mockResolvedValue(undefined);
    controller = new AdminHomeDecorController(prisma as any, redis as any);
    jest.spyOn(controller['logger'], 'warn').mockImplementation(() => {});
  });

  it('normalizes keywords and navigation entries before persistence and invalidates search hot cache', async () => {
    prisma.systemConfig.upsert.mockResolvedValue({ id: 7n });

    const result: any = await controller.updateConfig({
      hotKeywords: [' 奶粉 ', '纸尿裤', '奶粉'],
      navIcons: [{
        icon: ' /uploads/public/nav.png ',
        name: ' 母婴好物 ',
        linkUrl: ' /pages/product/list ',
        sort: 20,
      }],
      announcement: ' 首页公告 ',
    } as any);

    expect(result.value).toEqual({
      hotKeywords: ['奶粉', '纸尿裤'],
      navIcons: [{
        icon: '/uploads/public/nav.png',
        name: '母婴好物',
        linkUrl: '/pages/product/list',
        sort: 20,
      }],
      announcement: '首页公告',
    });
    expect(prisma.systemConfig.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({
        configValue: JSON.stringify(result.value),
        valueType: 'json',
      }),
    }));
    expect(redis.del).toHaveBeenCalledWith('search:hot_keywords');
  });

  it('keeps a successful database update even when cache invalidation fails', async () => {
    prisma.systemConfig.upsert.mockResolvedValue({ id: 8n });
    redis.del.mockRejectedValue(new Error('redis unavailable'));

    const result: any = await controller.updateConfig({
      hotKeywords: ['奶粉'],
      navIcons: [],
      announcement: '',
    } as any);

    expect(result.id).toBe('8');
    expect(redis.del).toHaveBeenCalledWith('search:hot_keywords');
    expect(controller['logger'].warn).toHaveBeenCalledWith(expect.stringContaining('缓存失效失败'));
  });

  it('rejects invalid navigation targets before writing configuration', async () => {
    await expect(controller.updateConfig({
      hotKeywords: [],
      navIcons: [{
        icon: '/uploads/public/nav.png',
        name: '外部链接',
        linkUrl: 'https://evil.example.com/path',
        sort: 0,
      }],
      announcement: '',
    } as any)).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.systemConfig.upsert).not.toHaveBeenCalled();
    expect(redis.del).not.toHaveBeenCalled();
  });

  it('filters malformed historical navigation entries when reading config', async () => {
    prisma.systemConfig.findFirst.mockResolvedValue({
      configValue: JSON.stringify({
        hotKeywords: [' 奶粉 ', '', '奶粉', 123],
        navIcons: [
          { icon: '/uploads/public/good.png', name: '积分', linkUrl: 'points', sort: 10 },
          { icon: '/uploads/public/bad.png', name: '外链', linkUrl: 'https://example.com', sort: 20 },
          { icon: '', name: '无图标', linkUrl: '/pages/home/index', sort: 30 },
        ],
        announcement: ' 公告 ',
      }),
    });

    const result = await controller.getConfig();

    expect(result).toEqual({
      hotKeywords: ['奶粉'],
      navIcons: [{ icon: '/uploads/public/good.png', name: '积分', linkUrl: 'points', sort: 10 }],
      announcement: '公告',
    });
  });
});
