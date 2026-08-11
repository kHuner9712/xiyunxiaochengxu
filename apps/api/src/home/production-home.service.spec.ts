import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { HomeService } from './home.service';
import { ProductionHomeService } from './production-home.service';

function createMockPrisma() {
  return {
    banner: {
      findMany: jest.fn() as any,
    },
    systemConfig: {
      findMany: jest.fn() as any,
    },
  };
}

describe('ProductionHomeService storefront branding', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let baseSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    process.env.UPLOAD_PUBLIC_URL = 'https://api.example.com';
    prisma = createMockPrisma();
    prisma.banner.findMany.mockResolvedValue([]);
    prisma.systemConfig.findMany.mockResolvedValue([]);
    baseSpy = jest.spyOn(HomeService.prototype, 'getHomeData').mockResolvedValue({
      banners: [],
      quickEntries: [],
      announcement: '',
      recommendations: [],
      monthRecommend: [],
      hotProducts: [],
      newProducts: [],
      activities: [],
    } as any);
  });

  afterEach(() => {
    baseSpy.mockRestore();
    delete process.env.UPLOAD_PUBLIC_URL;
  });

  it('returns safe default storefront branding when basic config is absent', async () => {
    const service = new ProductionHomeService(prisma as any);

    const result = await service.getHomeData();

    expect(result.brand).toEqual({ name: '禧孕优选', logo: '' });
    expect(baseSpy).toHaveBeenCalledWith(undefined);
  });

  it('uses configured shop name and normalized logo without dropping base home sections', async () => {
    prisma.systemConfig.findMany.mockResolvedValue([
      { configKey: 'shop_name', configValue: ' 禧孕优选旗舰店 ' },
      { configKey: 'shop_logo', configValue: '/uploads/public/shop-logo.png' },
    ]);
    const service = new ProductionHomeService(prisma as any);

    const result = await service.getHomeData('88');

    expect(result.brand).toEqual({
      name: '禧孕优选旗舰店',
      logo: 'https://api.example.com/uploads/public/shop-logo.png',
    });
    expect(result.recommendations).toEqual([]);
    expect(result.quickEntries).toEqual([]);
    expect(baseSpy).toHaveBeenCalledWith('88');
    expect(prisma.systemConfig.findMany).toHaveBeenCalledWith({
      where: {
        groupName: 'basic',
        configKey: { in: ['shop_name', 'shop_logo'] },
      },
      select: { configKey: true, configValue: true },
    });
  });
});
