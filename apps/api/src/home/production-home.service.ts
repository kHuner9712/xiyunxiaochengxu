import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { getAssetBaseUrl, normalizeAssetUrl } from '../common/utils/asset-url';
import { HomeService } from './home.service';

const DEFAULT_SHOP_NAME = '禧孕优选';

@Injectable()
export class ProductionHomeService extends HomeService {
  private readonly productionAssetBaseUrl = getAssetBaseUrl();

  constructor(private readonly productionPrisma: PrismaService) {
    super(productionPrisma);
  }

  override async getHomeData(userId?: string) {
    const base = await super.getHomeData(userId);
    const now = new Date();
    const [banners, brandConfigs] = await Promise.all([
      this.productionPrisma.banner.findMany({
        where: {
          status: 1,
          AND: [
            { OR: [{ startTime: null }, { startTime: { lte: now } }] },
            { OR: [{ endTime: null }, { endTime: { gte: now } }] },
          ],
        },
        orderBy: { sortOrder: 'asc' },
        take: 10,
      }),
      this.productionPrisma.systemConfig.findMany({
        where: {
          groupName: 'basic',
          configKey: { in: ['shop_name', 'shop_logo'] },
        },
        select: { configKey: true, configValue: true },
      }),
    ]);
    const brandConfig = new Map(brandConfigs.map((config) => [config.configKey, config.configValue]));
    const configuredName = String(brandConfig.get('shop_name') || '').trim().slice(0, 80);
    const configuredLogo = String(brandConfig.get('shop_logo') || '').trim();

    return {
      ...base,
      brand: {
        name: configuredName || DEFAULT_SHOP_NAME,
        logo: normalizeAssetUrl(configuredLogo, this.productionAssetBaseUrl),
      },
      banners: banners.map((banner) => ({
        ...banner,
        id: banner.id.toString(),
        image: normalizeAssetUrl(banner.image, this.productionAssetBaseUrl),
      })),
    };
  }
}
