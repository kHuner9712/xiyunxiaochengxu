import { OrderStatus } from '@prisma/client';
import { PAYMENT_STATUS, REFUND_STATUS } from '../common/constants';
import { PaymentReconcileService } from './payment-reconcile.service';
import { HistoricalAnomalyPaymentReconcileService } from './historical-anomaly-payment-reconcile.service';

describe('HistoricalAnomalyPaymentReconcileService', () => {
  afterEach(() => jest.restoreAllMocks());

  function createService(orders: any[], existingTasks: any[] = []) {
    const prisma: any = {
      order: {
        findMany: jest.fn().mockResolvedValue(orders),
      },
      paymentCompensationTask: {
        findMany: jest.fn().mockResolvedValue(existingTasks),
        createMany: jest.fn().mockImplementation(async ({ data }: any) => ({ count: data.length })),
      },
    };
    const paymentService: any = {};
    const businessEvent: any = {};
    const service = new HistoricalAnomalyPaymentReconcileService(
      prisma,
      paymentService,
      businessEvent,
    );
    return { service, prisma };
  }

  const cancelledPaidOrder = (overrides: any = {}) => ({
    id: 42n,
    orderNo: 'O42',
    payAmount: 1000,
    payment: {
      id: 7n,
      amount: 1000,
      transactionId: 'WX-TX-42',
    },
    orderRefunds: [],
    ...overrides,
  });

  it('seeds a durable manual task for cancelled WeChat SUCCESS exposure', async () => {
    jest.spyOn(PaymentReconcileService.prototype, 'reconcilePendingPayments').mockResolvedValue({
      total: 0,
      fixed: 0,
      failed: 0,
      skipped: 0,
    });
    const { service, prisma } = createService([cancelledPaidOrder()]);

    const result = await service.reconcilePendingPayments();

    expect(prisma.order.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: OrderStatus.cancelled,
        payAmount: { gt: 0 },
        payment: {
          is: expect.objectContaining({
            status: PAYMENT_STATUS.SUCCESS,
            paymentMethod: 'wechat',
            transactionId: { not: null },
          }),
        },
      }),
    }));
    expect(prisma.paymentCompensationTask.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({
        orderNo: 'O42',
        transactionId: 'WX-TX-42',
        amount: 1000,
        reason: 'cancelled_order_paid_historical_anomaly',
        status: 'pending',
      })],
      skipDuplicates: true,
    });
    expect(result).toEqual(expect.objectContaining({
      cancelledPaidDetected: 1,
      cancelledPaidSeeded: 1,
    }));
  });

  it('records only the still-unrefunded balance after a partial refund', async () => {
    jest.spyOn(PaymentReconcileService.prototype, 'reconcilePendingPayments').mockResolvedValue({
      total: 0,
      fixed: 0,
      failed: 0,
      skipped: 0,
    });
    const order = cancelledPaidOrder({
      orderRefunds: [
        { id: 1n, refundAmount: 400, status: REFUND_STATUS.SUCCESS, outRefundNo: 'R1' },
        { id: 2n, refundAmount: 100, status: REFUND_STATUS.CLOSED, outRefundNo: 'R2' },
      ],
    });
    const { service, prisma } = createService([order]);

    await service.reconcilePendingPayments();

    const payload = prisma.paymentCompensationTask.createMany.mock.calls[0][0].data[0];
    expect(payload.amount).toBe(600);
    expect(payload.callbackPayload.countedRefundAmount).toBe(400);
    expect(payload.callbackPayload.outstandingAmount).toBe(600);
    expect(payload.callbackPayload.countedRefunds).toHaveLength(1);
  });

  it('does not create a task when active or successful refunds fully cover the paid amount', async () => {
    jest.spyOn(PaymentReconcileService.prototype, 'reconcilePendingPayments').mockResolvedValue({
      total: 0,
      fixed: 0,
      failed: 0,
      skipped: 0,
    });
    const order = cancelledPaidOrder({
      orderRefunds: [
        { id: 1n, refundAmount: 700, status: REFUND_STATUS.SUCCESS, outRefundNo: 'R1' },
        { id: 2n, refundAmount: 300, status: REFUND_STATUS.PROCESSING, outRefundNo: 'R2' },
      ],
    });
    const { service, prisma } = createService([order]);

    const result = await service.reconcilePendingPayments();

    expect(prisma.paymentCompensationTask.createMany).not.toHaveBeenCalled();
    expect(result.cancelledPaidDetected).toBe(0);
    expect(result.cancelledPaidSeeded).toBe(0);
  });

  it('does not reseed an anomaly that already has the same order and transaction task', async () => {
    jest.spyOn(PaymentReconcileService.prototype, 'reconcilePendingPayments').mockResolvedValue({
      total: 0,
      fixed: 0,
      failed: 0,
      skipped: 0,
    });
    const { service, prisma } = createService(
      [cancelledPaidOrder()],
      [{ orderNo: 'O42', transactionId: 'WX-TX-42' }],
    );

    const result = await service.reconcilePendingPayments();

    expect(prisma.paymentCompensationTask.createMany).not.toHaveBeenCalled();
    expect(result.cancelledPaidDetected).toBe(0);
    expect(result.cancelledPaidSeeded).toBe(0);
  });
});
