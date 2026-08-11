import { AttributionSafeQuotaActivityMultiItemCheckoutService } from './attribution-safe-quota-activity-multi-item-checkout.service';
import { QuotaSafeActivityMultiItemCheckoutService } from './quota-safe-activity-multi-item-checkout.service';

const baseDto: any = {
  activityProductId: '20',
  skuId: '30',
  quantity: 1,
  fulfillmentType: 'delivery',
  addressId: '40',
};

describe('AttributionSafeQuotaActivityMultiItemCheckoutService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('removes a stopped merchant code before delegating to the quota-safe checkout', async () => {
    const prisma: any = {
      merchantPromotionSource: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const service = new AttributionSafeQuotaActivityMultiItemCheckoutService(
      prisma,
      {} as any,
      {} as any,
    );
    const parentCreate = jest
      .spyOn(QuotaSafeActivityMultiItemCheckoutService.prototype, 'createOrder')
      .mockResolvedValue({ orderId: 99n } as any);

    await service.createOrder(1n, 2n, 3n, 4n, {
      ...baseDto,
      sourceType: 'merchant_referral',
      sourceCode: 'STOPPED',
      referrerUserId: '8',
    });

    expect(prisma.merchantPromotionSource.findFirst).toHaveBeenCalledWith({
      where: { promotionCode: 'STOPPED', deletedAt: null, status: 1 },
      select: { id: true },
    });
    expect(parentCreate).toHaveBeenCalledWith(
      1n,
      2n,
      3n,
      4n,
      expect.objectContaining({
        sourceType: 'user_referral',
        sourceCode: undefined,
        referrerUserId: '8',
      }),
    );
  });

  it('normalizes an active merchant code before delegating', async () => {
    const prisma: any = {
      merchantPromotionSource: {
        findFirst: jest.fn().mockResolvedValue({ id: 55n }),
      },
    };
    const service = new AttributionSafeQuotaActivityMultiItemCheckoutService(
      prisma,
      {} as any,
      {} as any,
    );
    const parentCreate = jest
      .spyOn(QuotaSafeActivityMultiItemCheckoutService.prototype, 'createOrder')
      .mockResolvedValue({ orderId: 99n } as any);

    await service.createOrder(1n, 2n, 3n, 4n, {
      ...baseDto,
      sourceType: 'merchant_referral',
      sourceCode: ' shop-y ',
    });

    expect(parentCreate).toHaveBeenCalledWith(
      1n,
      2n,
      3n,
      4n,
      expect.objectContaining({
        sourceType: 'merchant_referral',
        sourceCode: 'SHOP-Y',
      }),
    );
  });
});
