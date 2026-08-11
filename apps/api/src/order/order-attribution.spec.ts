import { resolveCreateOrderAttribution, type MerchantPromotionSourceLookup } from './order-attribution';
import type { CreateOrderDto } from './dto/create-order.dto';

function dto(overrides: Partial<CreateOrderDto> = {}): CreateOrderDto {
  return {
    items: [{ skuId: '1', quantity: 1 }],
    ...overrides,
  } as CreateOrderDto;
}

function lookup(result: { id: bigint } | null) {
  const findFirst = jest.fn().mockResolvedValue(result);
  return {
    lookup: { merchantPromotionSource: { findFirst } } as MerchantPromotionSourceLookup,
    findFirst,
  };
}

describe('resolveCreateOrderAttribution', () => {
  it('keeps an active merchant source and normalizes its code before persistence', async () => {
    const { lookup: sourceLookup, findFirst } = lookup({ id: BigInt(9) });
    const input = dto({
      sourceType: 'merchant_referral',
      sourceCode: '  shop-a  ',
      referrerUserId: '88',
    });

    const result = await resolveCreateOrderAttribution(sourceLookup, input);

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        promotionCode: 'SHOP-A',
        deletedAt: null,
        status: 1,
      },
      select: { id: true },
    });
    expect(result.sourceType).toBe('merchant_referral');
    expect(result.sourceCode).toBe('SHOP-A');
    expect(result.referrerUserId).toBe('88');
    expect(input.sourceCode).toBe('  shop-a  ');
  });

  it('does not block checkout for a disabled/deleted merchant source and falls back to user referral', async () => {
    const { lookup: sourceLookup } = lookup(null);
    const result = await resolveCreateOrderAttribution(sourceLookup, dto({
      sourceType: 'merchant_referral',
      sourceCode: 'OLD-MERCHANT',
      shareRecordId: '100',
      referrerUserId: '200',
    }));

    expect(result.sourceType).toBe('user_referral');
    expect(result.sourceCode).toBeUndefined();
    expect(result.shareRecordId).toBe('100');
    expect(result.referrerUserId).toBe('200');
  });

  it('falls back to campaign when no user referral context remains', async () => {
    const { lookup: sourceLookup } = lookup(null);
    const result = await resolveCreateOrderAttribution(sourceLookup, dto({
      sourceType: 'merchant_referral',
      sourceCode: 'STOPPED',
      shareCampaignId: '300',
    }));

    expect(result.sourceType).toBe('campaign');
    expect(result.sourceCode).toBeUndefined();
    expect(result.shareCampaignId).toBe('300');
  });

  it('falls back to direct for a stale merchant code with no other attribution context', async () => {
    const { lookup: sourceLookup } = lookup(null);
    const result = await resolveCreateOrderAttribution(sourceLookup, dto({
      sourceType: 'merchant_referral',
      sourceCode: 'STOPPED',
    }));

    expect(result.sourceType).toBe('direct');
    expect(result.sourceCode).toBeUndefined();
  });

  it('does not query merchant sources for non-merchant attribution', async () => {
    const { lookup: sourceLookup, findFirst } = lookup({ id: BigInt(9) });
    const input = dto({ sourceType: 'campaign', shareCampaignId: '300' });

    const result = await resolveCreateOrderAttribution(sourceLookup, input);

    expect(result).toBe(input);
    expect(findFirst).not.toHaveBeenCalled();
  });
});
