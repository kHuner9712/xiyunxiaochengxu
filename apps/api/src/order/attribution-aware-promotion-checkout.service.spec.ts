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

describe('AttributionAwarePromotionCheckoutService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('recovers durable share attribution for referral promotion orders', async () => {
    const tx: any = {
      userInviteRelation: {
        findFirst: jest.fn().mockResolvedValue({
          inviterUserId: 1n,
          sourceShareRecordId: 2n,
          sourceCampaignId: 3n,
        }),
      },
    };
    const systemConfig: any = {};
    const service = new AttributionAwarePromotionCheckoutService({} as any, systemConfig);
    const baseCreate = jest
      .spyOn(PromotionCheckoutService.prototype, 'createOrder')
      .mockResolvedValue({ orderId: 9n } as any);

    await service.createOrder(tx, { ...baseInput, sourceType: 'user_referral' });

    expect(baseCreate).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        referrerUserId: '1',
        shareRecordId: '2',
        shareCampaignId: '3',
      }),
    );
  });

  it('keeps explicit attribution values instead of overwriting them', async () => {
    const tx: any = {
      userInviteRelation: {
        findFirst: jest.fn().mockResolvedValue({
          inviterUserId: 1n,
          sourceShareRecordId: 2n,
          sourceCampaignId: 3n,
        }),
      },
    };
    const service = new AttributionAwarePromotionCheckoutService({} as any, {} as any);
    const baseCreate = jest
      .spyOn(PromotionCheckoutService.prototype, 'createOrder')
      .mockResolvedValue({ orderId: 9n } as any);

    await service.createOrder(tx, {
      ...baseInput,
      sourceType: 'campaign',
      referrerUserId: '11',
      shareRecordId: '12',
      shareCampaignId: '13',
    });

    expect(baseCreate).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        referrerUserId: '11',
        shareRecordId: '12',
        shareCampaignId: '13',
      }),
    );
  });

  it('does not attribute ordinary direct promotion orders without referral context', async () => {
    const tx: any = {
      userInviteRelation: { findFirst: jest.fn() },
    };
    const service = new AttributionAwarePromotionCheckoutService({} as any, {} as any);
    jest.spyOn(PromotionCheckoutService.prototype, 'createOrder').mockResolvedValue({ orderId: 9n } as any);

    await service.createOrder(tx, { ...baseInput, sourceType: 'direct' });

    expect(tx.userInviteRelation.findFirst).not.toHaveBeenCalled();
  });
});
