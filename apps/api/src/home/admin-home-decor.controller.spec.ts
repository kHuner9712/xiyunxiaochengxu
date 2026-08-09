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

describe('AdminHomeDecorController', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let controller: AdminHomeDecorController;

  beforeEach(() => {
    prisma = createMockPrisma();
    controller = new AdminHomeDecorController(prisma as any);
  });

  it('normalizes keywords and navigation entries before persistence', async () => {
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
