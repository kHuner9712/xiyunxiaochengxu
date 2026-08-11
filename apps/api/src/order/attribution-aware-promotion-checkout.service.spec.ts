import { AttributionAwarePromotionCheckoutService } from './attribution-aware-promotion-checkout.service';
import { PromotionCheckoutService } from './promotion-checkout.service';

const baseInput: any = {
  userId: 7n,
  skuId: 20n,
  quantity: 1,
  unitPrice: 100,
  activityId: 30n,
  activityType: 'activity',
  fulfillmentType: 'delivery',
  addressId: '40',
};

function tx(overrides: Record<string, any> = {}) {
  return {
    merchantPromotionSource: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    userInviteRelation: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    ...overrides,
  } as any;
}

describe('AttributionAwarePromotionCheckoutService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('recovers durable share attribution for referral promotion orders', async () => {
    const transaction = tx({
      userInviteRelation: {
        findFirst: jest.fn().mockResolvedValue({
          inviterUserId: 1n,
          sourceShareRecordId: 2n,
          sourceCampaignId: 3n,
        }),
      },
    });
    const service = new AttributionAwarePromotionCheckoutService({} as any);
    const baseCreate = jest
      .spyOn(PromotionCheckoutService.prototype, 'createOrder')
      .mockResolvedValue({ orderId: 9n } as any);

    await service.createOrder(transaction, { ...baseInput, sourceType: 'user_referral' });

    expect(baseCreate).toHaveBeenCalledWith(
      transaction,
      expect.objectContaining({
        referrerUserId: '1',
        shareRecordId: '2',
        shareCampaignId: '3',
      }),
    );
  });

  it('keeps explicit attribution values instead of overwriting them', async () => {
    const transaction = tx({
      userInviteRelation: {
        findFirst: jest.fn().mockResolvedValue({
          inviterUserId: 1n,
          sourceShareRecordId: 2n,
          sourceCampaignId: 3n,
        }),
      },
    });
    const service = new AttributionAwarePromotionCheckoutService({} as any);
    const baseCreate = jest
      .spyOn(PromotionCheckoutService.prototype, 'createOrder')
      .mockResolvedValue({ orderId: 9n } as any);

    await service.createOrder(transaction, {
      ...baseInput,
      sourceType: 'campaign',
      referrerUserId: '11',
      shareRecordId: '12',
      shareCampaignId: '13',
    });

    expect(baseCreate).toHaveBeenCalledWith(
      transaction,
      expect.objectContaining({
        referrerUserId: '11',
        shareRecordId: '12',
        shareCampaignId: '13',
      }),
    );
  });

  it('does not attribute ordinary direct promotion orders without referral context', async () => {
    const transaction = tx();
    const service = new AttributionAwarePromotionCheckoutService({} as any);
    jest.spyOn(PromotionCheckoutService.prototype, 'createOrder').mockResolvedValue({ orderId: 9n } as any);

    await service.createOrder(transaction, { ...baseInput, sourceType: 'direct' });

    expect(transaction.merchantPromotionSource.findFirst).not.toHaveBeenCalled();
    expect(transaction.userInviteRelation.findFirst).not.toHaveBeenCalled();
  });

  it('keeps only an active merchant code and normalizes it before a promotion order is persisted', async () => {
    const transaction = tx({
      merchantPromotionSource: {
        findFirst: jest.fn().mockResolvedValue({ id: 55n }),
      },
    });
    const service = new AttributionAwarePromotionCheckoutService({} as any);
    const baseCreate = jest
      .spyOn(PromotionCheckoutService.prototype, 'createOrder')
      .mockResolvedValue({ orderId: 9n } as any);

    await service.createOrder(transaction, {
      ...baseInput,
      sourceType: 'merchant_referral',
      sourceCode: ' shop-x ',
    });

    expect(transaction.merchantPromotionSource.findFirst).toHaveBeenCalledWith({
      where: { promotionCode: 'SHOP-X', deletedAt: null, status: 1 },
      select: { id: true },
    });
    expect(baseCreate).toHaveBeenCalledWith(
      transaction,
      expect.objectContaining({ sourceType: 'merchant_referral', sourceCode: 'SHOP-X' }),
    );
  });

  it('degrades a stopped merchant code without blocking promotion checkout', async () => {
    const transaction = tx({
      merchantPromotionSource: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      userInviteRelation: {
        findFirst: jest.fn().mockResolvedValue({
          inviterUserId: 1n,
          sourceShareRecordId: 2n,
          sourceCampaignId: null,
        }),
      },
    });
    const service = new AttributionAwarePromotionCheckoutService({} as any);
    const baseCreate = jest
      .spyOn(PromotionCheckoutService.prototype, 'createOrder')
      .mockResolvedValue({ orderId: 9n } as any);

    await service.createOrder(transaction, {
      ...baseInput,
      sourceType: 'merchant_referral',
      sourceCode: 'STOPPED',
      referrerUserId: '1',
    });

    expect(baseCreate).toHaveBeenCalledWith(
      transaction,
      expect.objectContaining({
        sourceType: 'user_referral',
        sourceCode: undefined,
        referrerUserId: '1',
        shareRecordId: '2',
      }),
    );
  });
});
