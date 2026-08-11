import { BadRequestException } from '@nestjs/common';
import { RecoverableProductionPaymentService } from './recoverable-production-payment.service';
import { StockSafeRecoverableProductionPaymentService } from './stock-safe-recoverable-production-payment.service';

describe('StockSafeRecoverableProductionPaymentService', () => {
  function createService(type: number) {
    const orderItem = {
      id: 11n,
      productId: 5n,
      skuId: 6n,
      quantity: 3,
      subtotal: 3000,
    };
    const order = {
      id: 42n,
      totalAmount: 3000,
      payAmount: 3000,
      freightAmount: 0,
      discountAmount: 0,
      couponAmount: 0,
      pointsAmount: 0,
      activityDiscountAmount: 0,
      orderItems: [orderItem],
      orderRefunds: [],
      aftersaleOrders: [{ id: 9n, orderItemId: 11n }],
    };
    const prisma: any = {
      aftersaleOrder: {
        findFirst: jest.fn().mockResolvedValue({
          id: 9n,
          orderId: 42n,
          type,
          orderItem,
          order,
        }),
      },
    };
    const config: any = {
      get: jest.fn((key: string, fallback?: unknown) => {
        if (key === 'NODE_ENV') return 'test';
        return fallback;
      }),
    };
    const noop: any = {};
    const service = new StockSafeRecoverableProductionPaymentService(
      prisma,
      config,
      noop,
      noop,
      noop,
      noop,
      noop,
      noop,
      noop,
    );
    return { service, prisma };
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects a partial-amount return refund before the parent refund flow can call WeChat', async () => {
    const parentCreateRefund = jest
      .spyOn(RecoverableProductionPaymentService.prototype, 'createRefund')
      .mockResolvedValue({ refundId: '1', refundNo: 'R1', outRefundNo: 'OR1' } as any);
    const { service } = createService(2);

    await expect(
      service.createRefund({
        orderId: '42',
        aftersaleId: '9',
        refundAmount: 1000,
        reason: '退货退款',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(parentCreateRefund).not.toHaveBeenCalled();
  });

  it('allows a full remaining return refund to continue into the hardened parent flow', async () => {
    const parentCreateRefund = jest
      .spyOn(RecoverableProductionPaymentService.prototype, 'createRefund')
      .mockResolvedValue({ refundId: '1', refundNo: 'R1', outRefundNo: 'OR1' } as any);
    const { service } = createService(2);

    await service.createRefund({
      orderId: '42',
      aftersaleId: '9',
      refundAmount: 3000,
      reason: '退货退款',
    });

    expect(parentCreateRefund).toHaveBeenCalledTimes(1);
  });

  it('does not impose the full-amount rule on refund-only aftersales', async () => {
    const parentCreateRefund = jest
      .spyOn(RecoverableProductionPaymentService.prototype, 'createRefund')
      .mockResolvedValue({ refundId: '1', refundNo: 'R1', outRefundNo: 'OR1' } as any);
    const { service } = createService(1);

    await service.createRefund({
      orderId: '42',
      aftersaleId: '9',
      refundAmount: 1000,
      reason: '仅退款',
    });

    expect(parentCreateRefund).toHaveBeenCalledTimes(1);
  });
});
