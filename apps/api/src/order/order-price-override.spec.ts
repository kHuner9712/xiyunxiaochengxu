import { BadRequestException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { OrderService } from './order.service';

function createFixture() {
  const orderCreate = jest.fn();
  const paymentCreate = jest.fn();
  const tx: any = {
    productSku: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findFirst: jest.fn().mockResolvedValue({ productId: 20n, stock: 18 }),
    },
    productStockLog: { create: jest.fn().mockResolvedValue({}) },
    order: { create: orderCreate },
    orderPayment: { create: paymentCreate },
    cart: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
  };

  orderCreate.mockImplementation(async ({ data }: any) => ({
    id: 100n,
    orderNo: 'T100',
    status: OrderStatus.pending_payment,
    orderItems: data.orderItems.create,
  }));
  paymentCreate.mockResolvedValue({});

  const prisma: any = {
    pickupStore: {
      findFirst: jest.fn().mockResolvedValue({
        id: 40n,
        name: '测试自提点',
        province: '上海市',
        city: '上海市',
        district: '徐汇区',
        address: '测试路1号',
        contactPhone: '',
      }),
    },
    productSku: {
      findFirst: jest.fn().mockResolvedValue({
        id: 10n,
        productId: 20n,
        price: 1990,
        originalPrice: 2490,
        stock: 20,
        specs: {},
        image: null,
        product: {
          name: '测试商品',
          status: 1,
          mainImage: '/uploads/product.png',
          supplierId: 30n,
        },
      }),
    },
    $transaction: jest.fn(async (callback: any) => callback(tx)),
  };

  const service = new OrderService(
    prisma,
    { emitWarn: jest.fn() } as any,
    { grantBenefitsForOrder: jest.fn() } as any,
    { handleOrderCancel: jest.fn() } as any,
    { handleOrderCancel: jest.fn() } as any,
  );

  return { service, prisma, orderCreate, paymentCreate };
}

describe('OrderService promotional price override', () => {
  it('uses the server-side override as an activity discount', async () => {
    const { service, orderCreate, paymentCreate } = createFixture();

    const result = await service.create('1', {
      fulfillmentType: 'pickup',
      pickupStoreId: '40',
      items: [{ skuId: '10', quantity: 2, priceOverride: 990 }],
    });

    expect(result.payAmount).toBe(1980);
    expect(orderCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        totalAmount: 3980,
        activityDiscountAmount: 2000,
        payAmount: 1980,
        orderItems: {
          create: [expect.objectContaining({
            skuId: 10n,
            price: 990,
            originalPrice: 1990,
            quantity: 2,
            subtotal: 1980,
          })],
        },
      }),
    }));
    expect(paymentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ amount: 1980 }),
    });
  });

  it('rejects an override above the current SKU price', async () => {
    const { service, prisma } = createFixture();

    await expect(service.create('1', {
      fulfillmentType: 'pickup',
      pickupStoreId: '40',
      items: [{ skuId: '10', quantity: 1, priceOverride: 2990 }],
    })).rejects.toEqual(new BadRequestException('商品 测试商品 活动价格异常'));

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
