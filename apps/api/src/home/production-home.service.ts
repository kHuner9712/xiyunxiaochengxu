import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { getAssetBaseUrl, normalizeAssetUrl } from '../common/utils/asset-url';
import { HomeService } from './home.service';

@Injectable()
export class ProductionHomeService extends HomeService {
  private readonly productionAssetBaseUrl = getAssetBaseUrl();

  constructor(private readonly productionPrisma: PrismaService) {
    super(productionPrisma);
  }

  override async getHomeData(userId?: string) {
    const base = await super.getHomeData(userId);
    const now = new Date();
    const banners = await this.productionPrisma.banner.findMany({
      where: {
        status: 1,
        AND: [
          { OR: [{ startTime: null }, { startTime: { lte: now } }] },
          { OR: [{ endTime: null }, { endTime: { gte: now } }] },
        ],
      },
      orderBy: { sortOrder: 'asc' },
      take: 10,
    });
    return {
      ...base,
      banners: banners.map((banner) => ({
        ...banner,
        id: banner.id.toString(),
        image: normalizeAssetUrl(banner.image, this.productionAssetBaseUrl),
      })),
    };
  }
}
