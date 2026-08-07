import { describe, expect, it, jest } from '@jest/globals';
import { PaymentService } from './payment.service';
import { PAYMENT_STATUS, REFUND_STATUS } from '../common/constants';

function createServiceWithRefundFixture(completionReward: { points: number } | null) {
  const aftersale = {
    id: 10n,
    orderId: 100n,
    userId: 1000n,
    type: 1,
    refundAmount: 1000,
    orderItem: null,
    order: {
      id: 100n,
      payAmount: 10000,
      pointsDeducted: 0,
      completedAt: null,
    },
  };
  const refund = {
    id: 1n,
    outRefundNo: 'REFUND_POINTS_GUARD',
    refundAmount: 1000,
    totalAmount: 10000,
    status: REFUND_STATUS.PENDING,
    aftersaleId: 10n,
  };
  const userUpdate = jest.fn();
  const pointsCreate = jest.fn();
  const pointsFindFirst = (jest.fn() as any).mockResolvedValue(completionReward);
  const tx = {
    orderRefund: {
      updateMany: (jest.fn() as any).mockResolvedValue({ count: 1 }),
      findUnique: jest.fn(),
      update: (jest.fn() as any).mockResolvedValue({ status: REFUND_STATUS.SUCCESS }),
    },
    aftersaleOrder: {
      findFirst: (jest.fn() as any)
        .mockResolvedValueOnce(aftersale)
        .mockResolvedValueOnce(null),
      update: (jest.fn() as any).mockResolvedValue({}),
    },
    productSku: { findFirst: jest.fn(), update: jest.fn() },
    productStockLog: { create: jest.fn() },
    user: {
      findFirst: (jest.fn() as any).mockResolvedValue({ id: 1000n, availablePoints: 100 }),
      update: userUpdate,
    },
    pointsRecord: { findFirst: pointsFindFirst, create: pointsCreate },
    order: { update: (jest.fn() as any).mockResolvedValue({}) },
  };
  const prisma = {
    $transaction: jest.fn(async (callback: any) => callback(tx)),
  };
  const configService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      const values: Record<string, any> = {
        NODE_ENV: 'test',
        WECHAT_SKIP_VERIFY: 'true',
        WECHAT_API_V3_KEY: '0123456789abcdef0123456789abcdef',
      };
      return values[key] ?? defaultValue ?? '';
    }),
  };
  const businessEvent = { emitInfo: jest.fn(), emitWarn: jest.fn(), emitError: jest.fn(), emitCritical: jest.fn() };
  const orderService = {};
  const shareService = { processFirstPaidReward: jest.fn() };
  const benefitService = { grantBenefitsForOrder: jest.fn() };
  const settlementService = { generateSalesCommission: jest.fn() };
  const groupBuyService = { handlePaymentSuccess: jest.fn(), handleOrderCancel: jest.fn() };
  const flashSaleService = { handlePaymentSuccess: jest.fn(), handleOrderCancel: jest.fn() };
  const service = new PaymentService(
    prisma as any,
    configService as any,
    businessEvent as any,
    orderService as any,
    shareService as any,
    benefitService as any,
    settlementService as any,
    groupBuyService as any,
    flashSaleService as any,
  );
  jest.spyOn(service['logger'], 'log').mockImplementation(() => undefined);
  jest.spyOn(service['logger'], 'warn').mockImplementation(() => undefined);
  jest.spyOn(service['logger'], 'error').mockImplementation(() => undefined);
  return { service, refund, userUpdate, pointsCreate, pointsFindFirst };
}

describe('PaymentService refund earned-points guard', () => {
  it('does not deduct a user existing points balance when the order never earned completion points', async () => {
    const { service, refund, userUpdate, pointsCreate, pointsFindFirst } = createServiceWithRefundFixture(null);

    await service.processWechatRefundSuccess(refund, 'WX_REFUND_ID', {
      amount: { refund: 1000, total: 10000 },
    });

    expect(pointsFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId: 1000n,
        sourceId: 100n,
        source: { in: ['order_complete', 'order_auto_complete'] },
        type: 1,
      }),
    }));
    expect(userUpdate).not.toHaveBeenCalled();
    expect(pointsCreate).not.toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ source: 'aftersale_refund_deduct_reward' }),
    }));
    expect(pointsCreate).not.toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ source: 'aftersale_refund_deduct_reward_partial' }),
    }));
  });

  it('deducts only the proportional amount of the completion reward that was actually recorded', async () => {
    const { service, refund, userUpdate, pointsCreate } = createServiceWithRefundFixture({ points: 80 });

    await service.processWechatRefundSuccess(refund, 'WX_REFUND_ID', {
      amount: { refund: 1000, total: 10000 },
    });

    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: 1000n },
      data: { availablePoints: { decrement: 8 } },
    });
    expect(pointsCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: 2,
        points: 8,
        source: 'aftersale_refund_deduct_reward',
        sourceId: 10n,
      }),
    }));
  });
});