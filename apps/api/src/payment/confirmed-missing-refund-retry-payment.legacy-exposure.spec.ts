import { jest } from '@jest/globals';
import { REFUND_STATUS } from '../common/constants';
import { ConfirmedMissingRefundRetryPaymentService } from './confirmed-missing-refund-retry-payment.service';
import { MemberGrowthConservingPaymentService } from './member-growth-conserving-payment.service';

function createService() {
  const prisma: any = {
    paymentCompensationTask: {
      findMany: jest.fn(async () => []),
      findFirst: jest.fn(),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    order: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    orderPayment: {
      findUnique: jest.fn(),
    },
    orderRefund: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
  };
  const config: any = { get: jest.fn((_key: string, fallback?: unknown) => fallback ?? '') };
  const businessEvent: any = { emitCritical: jest.fn() };
  const service = new ConfirmedMissingRefundRetryPaymentService(
    prisma,
    config,
    businessEvent,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );
  return { service, prisma };
}

describe('ConfirmedMissingRefundRetryPaymentService legacy cancelled-paid exposure healing', () => {
  afterEach(() => jest.restoreAllMocks());

  it('reopens a legacy ignored task when SUCCESS refunds still leave customer cash exposed', async () => {
    const { service, prisma } = createService();
    prisma.paymentCompensationTask.findMany.mockResolvedValue([{
      id: 61n,
      orderNo: 'O61',
      transactionId: 'WX-61',
      amount: 1000,
      reason: 'cancelled_order_paid_historical_anomaly',
      status: 'ignored',
      handledBy: 'admin-1',
      callbackPayload: { legacy: true },
      updatedAt: new Date(),
    }]);
    prisma.order.findFirst.mockResolvedValue({
      id: 61n,
      orderNo: 'O61',
      payAmount: 1000,
      payment: { id: 601n, amount: 1000 },
      orderRefunds: [
        { status: REFUND_STATUS.SUCCESS, refundAmount: 400 },
        { status: REFUND_STATUS.PROCESSING, refundAmount: 600 },
      ],
    });
    jest
      .spyOn(MemberGrowthConservingPaymentService.prototype as any, 'reconcileRefundSuccessSideEffects')
      .mockResolvedValue({ total: 0, resolved: 0, failed: 0, skipped: 0 });

    const result = await service.reconcileRefundSuccessSideEffects(200);

    expect(prisma.paymentCompensationTask.findMany).toHaveBeenCalledWith({
      where: {
        reason: {
          in: expect.arrayContaining([
            'cancelled_order_paid_callback',
            'cancelled_order_paid_historical_anomaly',
          ]),
        },
        status: { in: ['resolved', 'ignored'] },
        NOT: { handledBy: 'system:historical-cancelled-paid-reconcile' },
      },
      orderBy: { updatedAt: 'asc' },
      take: 200,
    });
    expect(prisma.paymentCompensationTask.updateMany).toHaveBeenCalledWith({
      where: { id: 61n, status: { in: ['resolved', 'ignored'] } },
      data: expect.objectContaining({
        amount: 600,
        status: 'pending',
        handledBy: null,
        handledAt: null,
        resolution: expect.stringContaining('仍有600分未被SUCCESS退款证明退回'),
        callbackPayload: expect.objectContaining({
          legacy: true,
          recoveryReconciliation: expect.objectContaining({
            orderId: '61',
            paidAmount: 1000,
            successfulRefundAmount: 400,
            outstandingAmount: 600,
            recoveredFromStatus: 'ignored',
            recoveredHandledBy: 'admin-1',
          }),
        }),
      }),
    });
    expect(result).toEqual(expect.objectContaining({
      cancelledPaidExposure: {
        checked: 1,
        reopened: 1,
        verifiedResolved: 0,
        failed: 0,
      },
    }));
  });

  it('converts a legacy manual closure into system evidence when SUCCESS refunds cover all cash', async () => {
    const { service, prisma } = createService();
    prisma.paymentCompensationTask.findMany.mockResolvedValue([{
      id: 62n,
      orderNo: 'O62',
      transactionId: 'WX-62',
      amount: 1000,
      reason: 'cancelled_order_paid_callback',
      status: 'resolved',
      handledBy: 'admin-2',
      callbackPayload: {},
      updatedAt: new Date(),
    }]);
    prisma.order.findFirst.mockResolvedValue({
      id: 62n,
      orderNo: 'O62',
      payAmount: 1000,
      payment: { id: 602n, amount: 1000 },
      orderRefunds: [
        { status: REFUND_STATUS.SUCCESS, refundAmount: 1000 },
      ],
    });
    jest
      .spyOn(MemberGrowthConservingPaymentService.prototype as any, 'reconcileRefundSuccessSideEffects')
      .mockResolvedValue({ total: 0, resolved: 0, failed: 0, skipped: 0 });

    const result = await service.reconcileRefundSuccessSideEffects(200);

    expect(prisma.paymentCompensationTask.updateMany).toHaveBeenCalledWith({
      where: { id: 62n, status: { in: ['resolved', 'ignored'] } },
      data: expect.objectContaining({
        amount: 0,
        status: 'resolved',
        handledBy: 'system:historical-cancelled-paid-reconcile',
        handledAt: expect.any(Date),
        resolution: expect.stringContaining('SUCCESS退款已覆盖全部实付金额1000分'),
      }),
    });
    expect(result).toEqual(expect.objectContaining({
      cancelledPaidExposure: {
        checked: 1,
        reopened: 0,
        verifiedResolved: 1,
        failed: 0,
      },
    }));
  });

  it('fails closed when a legacy order pay amount is corrupted below payment and task evidence', async () => {
    const { service, prisma } = createService();
    prisma.paymentCompensationTask.findMany.mockResolvedValue([{
      id: 63n,
      orderNo: 'O63',
      transactionId: 'WX-63',
      amount: 1000,
      reason: 'cancelled_order_paid_callback',
      status: 'ignored',
      handledBy: 'admin-3',
      callbackPayload: {},
      updatedAt: new Date(),
    }]);
    prisma.order.findFirst.mockResolvedValue({
      id: 63n,
      orderNo: 'O63',
      payAmount: 0,
      payment: { id: 603n, amount: 1000 },
      orderRefunds: [
        { status: REFUND_STATUS.SUCCESS, refundAmount: 400 },
      ],
    });
    jest
      .spyOn(MemberGrowthConservingPaymentService.prototype as any, 'reconcileRefundSuccessSideEffects')
      .mockResolvedValue({ total: 0, resolved: 0, failed: 0, skipped: 0 });

    const result = await service.reconcileRefundSuccessSideEffects(200);

    expect(prisma.paymentCompensationTask.updateMany).toHaveBeenCalledWith({
      where: { id: 63n, status: { in: ['resolved', 'ignored'] } },
      data: expect.objectContaining({
        amount: 600,
        status: 'pending',
        callbackPayload: expect.objectContaining({
          recoveryReconciliation: expect.objectContaining({
            paidAmount: 1000,
            successfulRefundAmount: 400,
            outstandingAmount: 600,
          }),
        }),
      }),
    });
    expect(result.cancelledPaidExposure).toEqual({
      checked: 1,
      reopened: 1,
      verifiedResolved: 0,
      failed: 0,
    });
  });
});
