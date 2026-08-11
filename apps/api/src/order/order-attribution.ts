export interface OrderAttributionInput {
  sourceType?: string;
  sourceCode?: string;
  shareRecordId?: string;
  shareCampaignId?: string;
  referrerUserId?: string;
}

export interface MerchantPromotionSourceLookup {
  merchantPromotionSource: {
    findFirst(args: {
      where: {
        promotionCode: string;
        deletedAt: null;
        status: number;
      };
      select: { id: true };
    }): Promise<{ id: bigint } | null>;
  };
}

function fallbackSourceType(dto: OrderAttributionInput): string {
  if (dto.referrerUserId || dto.shareRecordId) return 'user_referral';
  if (dto.shareCampaignId) return 'campaign';
  return 'direct';
}

/**
 * Resolves the attribution snapshot that is allowed to be persisted on a NEW order.
 *
 * A merchant promotion code is an operational switch for future attribution. Disabling/deleting
 * the source must stop new orders from being attributed to it, while historical orders retain
 * their already-persisted snapshot and can still mature through settlement. Invalid/stale codes
 * therefore degrade attribution instead of blocking checkout.
 */
export async function resolveCreateOrderAttribution<T extends OrderAttributionInput>(
  lookup: MerchantPromotionSourceLookup,
  dto: T,
): Promise<T> {
  if (dto.sourceType !== 'merchant_referral') return dto;

  const normalizedCode = dto.sourceCode?.trim().toUpperCase() || '';
  if (normalizedCode) {
    const merchant = await lookup.merchantPromotionSource.findFirst({
      where: {
        promotionCode: normalizedCode,
        deletedAt: null,
        status: 1,
      },
      select: { id: true },
    });
    if (merchant) {
      return {
        ...dto,
        sourceType: 'merchant_referral',
        sourceCode: normalizedCode,
      };
    }
  }

  return {
    ...dto,
    sourceType: fallbackSourceType(dto),
    sourceCode: undefined,
  };
}
