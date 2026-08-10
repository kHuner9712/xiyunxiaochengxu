import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { getAssetBaseUrl, normalizeAssetUrl } from '../common/utils/asset-url';
import { ContentService } from './content.service';

const POSITIVE_ID = /^[1-9]\d*$/;
const MAX_SIGNED_BIGINT = 9223372036854775807n;

type PublicRelatedProductRow = {
  id: bigint;
  name: string;
  mainImage: string | null;
  minPrice: number | null;
};

/**
 * Public content view enrichment for the relation fields managed by the admin editor.
 *
 * Content records may outlive products or activities they once referenced. Returning only IDs
 * forces the miniprogram either to ignore the configured relation entirely or navigate users into
 * a 404. Resolve relations at read time and expose only targets that are currently public.
 */
@Injectable()
export class PublicRelatedContentService extends ContentService {
  private readonly publicAssetBaseUrl = getAssetBaseUrl();

  constructor(private readonly viewPrisma: PrismaService) {
    super(viewPrisma);
  }

  override async findPublishedById(id: string) {
    const content = await super.findPublishedById(id);
    const relatedProductIds = Array.isArray(content.relatedProductIds)
      ? content.relatedProductIds.map((value: unknown) => String(value)).filter((value: string) => this.isSafeId(value))
      : [];

    const productIdValues = relatedProductIds.map((value: string) => BigInt(value));
    const products: PublicRelatedProductRow[] = productIdValues.length > 0
      ? await this.viewPrisma.product.findMany({
          where: {
            id: { in: productIdValues },
            deletedAt: null,
            status: 1,
          },
          select: {
            id: true,
            name: true,
            mainImage: true,
            minPrice: true,
          },
        })
      : [];
    const productById = new Map(products.map((product) => [product.id.toString(), product]));
    const relatedProducts = relatedProductIds
      .map((productId: string) => productById.get(productId))
      .filter((product): product is PublicRelatedProductRow => product !== undefined)
      .map((product) => ({
        id: product.id.toString(),
        name: product.name,
        image: normalizeAssetUrl(product.mainImage, this.publicAssetBaseUrl),
        price: product.minPrice ?? 0,
      }));

    let relatedActivity: null | {
      id: string;
      name: string;
      image: string;
      type: string;
      startTime: Date;
      endTime: Date;
    } = null;
    const relatedActivityId = String(content.relatedActivityId || '');
    if (this.isSafeId(relatedActivityId)) {
      const now = new Date();
      const activity = await this.viewPrisma.activity.findFirst({
        where: {
          id: BigInt(relatedActivityId),
          status: 1,
          startTime: { lte: now },
          endTime: { gte: now },
        },
        select: {
          id: true,
          name: true,
          bannerImage: true,
          type: true,
          startTime: true,
          endTime: true,
        },
      });
      if (activity) {
        relatedActivity = {
          id: activity.id.toString(),
          name: activity.name,
          image: normalizeAssetUrl(activity.bannerImage, this.publicAssetBaseUrl),
          type: activity.type,
          startTime: activity.startTime,
          endTime: activity.endTime,
        };
      }
    }

    return {
      ...content,
      relatedProducts,
      relatedActivity,
    };
  }

  private isSafeId(value: string): boolean {
    if (!POSITIVE_ID.test(value)) return false;
    try {
      return BigInt(value) <= MAX_SIGNED_BIGINT;
    } catch {
      return false;
    }
  }
}
