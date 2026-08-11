import { ActivityCheckoutService } from './activity-checkout.service';
import { ExclusiveNewUserActivityCheckoutService } from './exclusive-new-user-activity-checkout.service';

const dto: any = {
  activityProductId: '10',
  skuId: '20',
  quantity: 1,
  addressId: '30',
  fulfillmentType: 'delivery',
};

function fixture(type = '5', existingOrders = 0, lockResult = true) {
  const prisma: any = {
    activity: { findUnique: jest.fn().mockResolvedValue({ type }) },
    order: { count: jest.fn().mockResolvedValue(existingOrders) },
  };
  const redis: any = {
    setNX: jest.fn().mockResolvedValue(lockResult),
    releaseLockWithLua: jest.fn().mockResolvedValue(true),
  };
  const promotionCheckout: any = {};
  const systemConfig: any = {};
  const multiItemCheckout: any = {};
  const service = new ExclusiveNewUserActivityCheckoutService(
    prisma,
    redis,
    promotionCheckout,
    systemConfig,
    multiItemCheckout,
  );
  return { service, prisma, redis };
}

describe('ExclusiveNewUserActivityCheckoutService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('rejects a new-user promotion when any non-cancelled order already exists', async () => {
    const { service } = fixture('5', 1);
    const superPreview = jest.spyOn(ActivityCheckoutService.prototype, 'preview');

    await expect(service.preview('7', '1', dto)).rejects.toThrow('新人优惠仅限尚未创建有效订单的新用户');
    expect(superPreview).not.toHaveBeenCalled();
  });

  it('serializes concurrent new-user checkouts with a user-level Redis lock', async () => {
    const { service, redis } = fixture('5', 0, false);
    const superCreate = jest.spyOn(ActivityCheckoutService.prototype, 'createOrder');

    await expect(service.createOrder('7', '1', dto)).rejects.toThrow('新人优惠资格正在处理中');
    expect(redis.setNX).toHaveBeenCalledWith('activity:new-user:7', expect.any(String), 120);
    expect(superCreate).not.toHaveBeenCalled();
  });

  it('holds the lock through server-side order creation and releases it afterwards', async () => {
    const { service, redis } = fixture('5', 0, true);
    jest.spyOn(ActivityCheckoutService.prototype, 'createOrder').mockResolvedValue({
      orderId: '99',
      orderNo: 'O99',
      payAmount: 100,
      isZeroPay: false,
      status: 'pending_payment' as any,
      fulfillmentType: 'delivery',
      activityId: '1',
      activityProductId: '10',
    } as any);

    await expect(service.createOrder('7', '1', dto)).resolves.toEqual(expect.objectContaining({ orderId: '99' }));
    expect(redis.releaseLockWithLua).toHaveBeenCalledWith('activity:new-user:7', expect.any(String));
  });

  it('does not impose new-user exclusivity on ordinary executable activities', async () => {
    const { service, prisma, redis } = fixture('1', 8, true);
    jest.spyOn(ActivityCheckoutService.prototype, 'createOrder').mockResolvedValue({ orderId: '88' } as any);

    await expect(service.createOrder('7', '1', dto)).resolves.toEqual({ orderId: '88' });
    expect(prisma.order.count).not.toHaveBeenCalled();
    expect(redis.setNX).not.toHaveBeenCalled();
  });
});
