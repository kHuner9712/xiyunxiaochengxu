import { ActivityCheckoutService } from './activity-checkout.service';

function createFixture() {
  const activity = {
    id: 1n,
    type: '1',
    status: 1,
    startTime: new Date(Date.now() - 60_000),
    endTime: new Date(Date.now() + 3_600_000),
    rules: null as any,
  };
  const activityProduct = {
    id: 10n,
    activityId: 1n,
    productId: 100n,
    skuId: 200n,
    activityPrice: 800,
    activityStock: 5,
    limitPerUser: 2,
  };
  const sku = {
    id: 200n,
    productId: 100n,
    price: 1000,
    stock: 10,
    image: '',
    specs: { size: 'M' },
    product: {
      id: 100n,
      name: '测试商品',
      status: 1,
      mainImage: '',
      fulfillmentType: 'delivery',
    },
  };
  const prisma: any = {
    activity: { findUnique: jest.fn().mockResolvedValue(activity) },
    activityProduct: { findFirst: jest.fn().mockResolvedValue(activityProduct) },
    productSku: { findFirst: jest.fn().mockResolvedValue(sku) },
    orderItem: { count: jest.fn().mockResolvedValue(0) },
    order: { count: jest.fn().mockResolvedValue(0) },
    userAddress: {
      findFirst: jest.fn().mockResolvedValue({ id: 300n, province: '广东省' }),
    },
    pickupStore: { findFirst: jest.fn() },
    $queryRaw: jest.fn()
      .mockResolvedValueOnce([{ quantity: 1 }])
      .mockResolvedValueOnce([{ quantity: 0 }]),
  };
  const tx: any = {
    ...prisma,
    $queryRaw: jest.fn()
      .mockResolvedValueOnce([{ id: 7n }])
      .mockResolvedValueOnce([{ id: 1n }])
      .mockResolvedValueOnce([{ id: 10n }])
      .mockResolvedValueOnce([{ quantity: 1 }])
      .mockResolvedValueOnce([{ quantity: 0 }]),
  };
  prisma.$transaction = jest.fn(async (callback: any) => callback(tx));
  const promotionCheckout: any = {
    createOrder: jest.fn().mockResolvedValue({
      orderId: 900n,
      orderItemId: 901n,
      orderNo: 'O900',
      payAmount: 2600,
      isZeroPay: false,
      status: 'pending_payment',
      fulfillmentType: 'delivery',
    }),
  };
  const systemConfig: any = {
    getRuntimeConfig: jest.fn().mockReturnValue({
      defaultFreight: 1000,
      freeShippingAmount: 9900,
      pointsDeductRate: 100,
    }),
  };
  const multiItemCheckout: any = {
    preview: jest.fn().mockResolvedValue({
      activityId: '1',
      activityProductId: '10',
      activityType: '3',
      promotionLabel: '满赠活动',
      items: [
        { skuId: '200', quantity: 2, subtotal: 2000, isGift: false },
        { skuId: '201', quantity: 1, subtotal: 0, isGift: true },
      ],
      totalAmount: 2500,
      activityDiscountAmount: 500,
      freightAmount: 1000,
      payAmount: 3000,
      fulfillmentType: 'delivery',
      isZeroPay: false,
      promotionStackingDisabled: true,
      maxQuantity: 2,
    }),
    createOrder: jest.fn().mockResolvedValue({
      orderId: '990',
      orderNo: 'O990',
      payAmount: 3000,
      isZeroPay: false,
      status: 'pending_payment',
      fulfillmentType: 'delivery',
      activityId: '1',
      activityProductId: '10',
    }),
  };
  const service = new ActivityCheckoutService(
    prisma,
    promotionCheckout,
    systemConfig,
    multiItemCheckout,
  );
  return {
    service,
    prisma,
    tx,
    promotionCheckout,
    multiItemCheckout,
    activity,
    activityProduct,
    sku,
  };
}

const deliveryDto = {
  activityProductId: '10',
  skuId: '200',
  quantity: 2,
  addressId: '300',
  fulfillmentType: 'delivery' as const,
};

describe('ActivityCheckoutService', () => {
  it('calculates limited-time discount from server SKU and activity price', async () => {
    const { service } = createFixture();
    const result = await service.preview('7', '1', deliveryDto);

    expect(result.totalAmount).toBe(2000);
    expect(result.activityDiscountAmount).toBe(400);
    expect(result.freightAmount).toBe(1000);
    expect(result.payAmount).toBe(2600);
    expect(result.items[0].price).toBe(800);
    expect(result.promotionStackingDisabled).toBe(true);
  });

  it('uses highest matched full-reduction threshold and never trusts a client price', async () => {
    const fixture = createFixture();
    fixture.activity.type = '2';
    fixture.activity.rules = {
      fullReductionRules: [
        { fullAmount: 1000, reduceAmount: 100 },
        { fullAmount: 2000, reduceAmount: 300 },
      ],
    };
    const result = await fixture.service.preview('7', '1', deliveryDto);

    expect(result.totalAmount).toBe(2000);
    expect(result.activityDiscountAmount).toBe(300);
    expect(result.items[0].price).toBe(1000);
    expect(result.payAmount).toBe(2700);
  });

  it('routes full-gift preview through the real multi-item checkout service', async () => {
    const fixture = createFixture();
    fixture.activity.type = '3';

    const result = await fixture.service.preview('7', '1', deliveryDto);

    expect(fixture.multiItemCheckout.preview).toHaveBeenCalledWith(
      7n,
      1n,
      10n,
      200n,
      deliveryDto,
    );
    expect(result.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ skuId: '201', isGift: true, subtotal: 0 }),
    ]));
  });

  it('routes bundle order creation through one multi-item transaction boundary', async () => {
    const fixture = createFixture();
    fixture.activity.type = '4';

    const result = await fixture.service.createOrder('7', '1', deliveryDto);

    expect(fixture.multiItemCheckout.createOrder).toHaveBeenCalledWith(
      7n,
      1n,
      10n,
      200n,
      deliveryDto,
    );
    expect(fixture.promotionCheckout.createOrder).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ orderId: '990', activityId: '1' }));
  });

  it('rejects quota overflow in preview instead of waiting until submit', async () => {
    const fixture = createFixture();
    fixture.prisma.$queryRaw = jest.fn()
      .mockResolvedValueOnce([{ quantity: 4 }])
      .mockResolvedValueOnce([{ quantity: 0 }]);

    await expect(fixture.service.preview('7', '1', deliveryDto))
      .rejects.toThrow('活动库存不足');
  });

  it('rejects new-user offer after an effective prior order', async () => {
    const fixture = createFixture();
    fixture.activity.type = '5';
    fixture.prisma.order.count.mockResolvedValue(1);

    await expect(fixture.service.preview('7', '1', deliveryDto))
      .rejects.toThrow('仅限尚未完成首笔有效订单的新用户');
  });

  it('revalidates economics inside locked transaction and passes only server values to safe checkout', async () => {
    const fixture = createFixture();
    const result = await fixture.service.createOrder('7', '1', deliveryDto);

    expect(fixture.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(fixture.promotionCheckout.createOrder).toHaveBeenCalledWith(
      fixture.tx,
      expect.objectContaining({
        userId: 7n,
        skuId: 200n,
        activityId: 1n,
        activityType: 'activity',
        unitPrice: 800,
        quantity: 2,
      }),
    );
    expect(result).toEqual(expect.objectContaining({
      orderId: '900',
      activityId: '1',
      activityProductId: '10',
    }));
  });
});
