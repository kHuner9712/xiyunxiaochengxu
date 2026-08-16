import { OrderStatus } from '@prisma/client';
import { PAYMENT_STATUS } from '../common/constants/payment';
import { PromotionCheckoutService } from './promotion-checkout.service';

function createTx(options: { fulfillmentType: 'delivery' | 'pickup'; skuPrice: number }) {
  const pickup = options.fulfillmentType === 'pickup';
  const tx: any = {
    userAddress: {
      findFirst: jest.fn().mockResolvedValue(pickup ? null : {
        id: 10n,
        receiverName: '测试用户',
        receiverPhone: '13800000000',
        province: '上海市',
        city: '上海市',
        district: '浦东新区',
        detailAddress: '测试路1号',
      }),
    },
    pickupStore: {
      findFirst: jest.fn().mockResolvedValue(pickup ? {
        id: 11n,
        name: '测试自提点',
        province: '上海市',
        city: '上海市',
        district: '浦东新区',
        address: '测试路2号',
        contactPhone: '02100000000',
      } : null),
    },
    productSku: {
      findFirst: jest.fn().mockResolvedValue({
        id: 20n,
        productId: 21n,
        price: options.skuPrice,
        image: '',
        specs: null,
        product: {
          name: '测试商品',
          status: 1,
          mainImage: '',
          supplierId: null,
          fulfillmentType: options.fulfillmentType,
        },
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUnique: jest.fn().mockResolvedValue({ stock: 9 }),
    },
    productStockLog: { create: jest.fn().mockResolvedValue({}) },
    order: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(async ({ data }: any) => ({
        id: 30n,
        orderNo: data.orderNo,
        status: data.status,
        orderItems: [{ id: 31n }],
      })),
    },
    orderPayment: { create: jest.fn().mockResolvedValue({ id: 40n }) },
    orderLog: { create: jest.fn().mockResolvedValue({}) },
    cart: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
  };
  return tx;
}

describe('PromotionCheckoutService payment record timing', () => {
  it('does not create a payment row before a positive-amount promotion order starts payment', async () => {
    const service = new PromotionCheckoutService();
    const tx = createTx({ fulfillmentType: 'pickup', skuPrice: 1000 });

    const result = await service.createOrder(tx, {
      userId: 1n,
      skuId: 20n,
      quantity: 1,
      unitPrice: 900,
      activityId: 50n,
      activityType: 'flash_sale',
      fulfillmentType: 'pickup',
      pickupStoreId: '11',
    });

    expect(result.payAmount).toBe(900);
    expect(result.status).toBe(OrderStatus.pending_payment);
    expect(tx.orderPayment.create).not.toHaveBeenCalled();
  });

  it('persists a SUCCESS zero-pay record in the same promotion checkout transaction', async () => {
    const service = new PromotionCheckoutService();
    const tx = createTx({ fulfillmentType: 'pickup', skuPrice: 1000 });

    const result = await service.createOrder(tx, {
      userId: 1n,
      skuId: 20n,
      quantity: 1,
      unitPrice: 0,
      activityId: 51n,
      activityType: 'flash_sale',
      fulfillmentType: 'pickup',
      pickupStoreId: '11',
    });

    expect(result.payAmount).toBe(0);
    expect(result.isZeroPay).toBe(true);
    expect(tx.orderPayment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: 30n,
        amount: 0,
        paymentMethod: 'zero_pay',
        status: PAYMENT_STATUS.SUCCESS,
        paidAt: expect.any(Date),
      }),
    });
    expect(tx.orderLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'pay_zero_amount' }),
    });
  });
});
