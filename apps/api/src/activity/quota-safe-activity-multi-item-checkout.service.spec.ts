import { ActivityMultiItemCheckoutService } from './activity-multi-item-checkout.service';
import { QuotaSafeActivityMultiItemCheckoutService } from './quota-safe-activity-multi-item-checkout.service';

function createFixture() {
  const prisma: any = {
    activity: {
      findUnique: jest.fn().mockResolvedValue({
        type: '3',
        rules: {
          fullGiftRules: [
            { fullAmount: 2000, giftSkuId: '200', giftQuantity: 1 },
          ],
        },
      }),
    },
    activityProduct: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 10n,
          skuId: 200n,
          activityStock: 3,
          limitPerUser: 3,
        },
      ]),
    },
    productSku: {
      findMany: jest.fn().mockResolvedValue([
        { id: 200n, price: 1000, stock: 3 },
      ]),
    },
    $queryRaw: jest.fn()
      .mockResolvedValue([{ quantity: 0 }]),
  };
  const redis: any = {
    setNX: jest.fn().mockResolvedValue(true),
    releaseLockWithLua: jest.fn().mockResolvedValue(true),
  };
  const systemConfig: any = {};
  const service = new QuotaSafeActivityMultiItemCheckoutService(prisma, redis, systemConfig);
  return { service, prisma, redis };
}

const dto = {
  activityProductId: '10',
  skuId: '200',
  quantity: 2,
  addressId: '300',
  fulfillmentType: 'delivery' as const,
};

describe('QuotaSafeActivityMultiItemCheckoutService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('clamps max quantity using paid + same-SKU gift aggregate quota', async () => {
    const { service } = createFixture();
    jest.spyOn(ActivityMultiItemCheckoutService.prototype, 'preview').mockResolvedValue({
      activityId: '1',
      activityProductId: '10',
      activityType: '3',
      promotionLabel: '满赠活动',
      items: [],
      totalAmount: 2000,
      activityDiscountAmount: 1000,
      merchandisePayAmount: 2000,
      freightAmount: 0,
      payAmount: 2000,
      fulfillmentType: 'delivery',
      isZeroPay: false,
      promotionStackingDisabled: true,
      maxQuantity: 3,
    } as any);

    const result = await service.preview(7n, 1n, 10n, 200n, dto as any);

    expect(result.maxQuantity).toBe(2);
  });

  it('allows buy-2-get-1 when the aggregate claim exactly fits quota', async () => {
    const { service, redis } = createFixture();
    const superCreate = jest.spyOn(ActivityMultiItemCheckoutService.prototype, 'createOrder')
      .mockResolvedValue({ orderId: '900' } as any);

    await expect(service.createOrder(7n, 1n, 10n, 200n, dto as any))
      .resolves.toEqual({ orderId: '900' });
    expect(superCreate).toHaveBeenCalled();
    expect(redis.releaseLockWithLua).toHaveBeenCalled();
  });

  it('rejects buy-3-get-1 because paid and gift quantities must share the same quota', async () => {
    const { service, redis } = createFixture();
    const superCreate = jest.spyOn(ActivityMultiItemCheckoutService.prototype, 'createOrder');

    await expect(service.createOrder(7n, 1n, 10n, 200n, { ...dto, quantity: 3 } as any))
      .rejects.toThrow('活动库存或限购不足');
    expect(superCreate).not.toHaveBeenCalled();
    expect(redis.releaseLockWithLua).toHaveBeenCalled();
  });

  it('fails closed when another checkout owns the activity lock', async () => {
    const { service, redis } = createFixture();
    redis.setNX.mockResolvedValue(false);
    const superCreate = jest.spyOn(ActivityMultiItemCheckoutService.prototype, 'createOrder');

    await expect(service.createOrder(7n, 1n, 10n, 200n, dto as any))
      .rejects.toThrow('活动库存正在结算');
    expect(superCreate).not.toHaveBeenCalled();
  });
});
