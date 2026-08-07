import { OrderStatus } from '@prisma/client';
import { PAYMENT_STATUS, REFUND_STATUS } from '../common/constants';
import { PaymentReconcileService } from './payment-reconcile.service';
import { HistoricalAnomalyPaymentReconcileService } from './historical-anomaly-payment-reconcile.service';

describe('HistoricalAnomalyPaymentReconcileService', () => {
  afterEach(() => jest.restoreAllMocks());

  function createService(rows: any[] = []) {
    const prisma: any = {
      $queryRaw: jest.fn().mockResolvedValue(rows),
      order: {
        findFirst: jest.fn(),
      },
      paymentCompensationTask: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockImplementation(async ({ data }: any) => ({ count: data.length })),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
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

  const exposureRow = (overrides: any = {}) => ({
    orderId: 42n,
    orderNo: 'O42',
    payAmount: 1000,
    paymentId: 7n,
    paymentAmount: 1000,
    transactionId: 'WX-TX-42',
    successfulRefundAmount: 0,
    activeRefundAmount: 0,
    ...overrides,
  });

  it('seeds the full unreturned cash exposure even while a refund is processing', async () => {
    jest.spyOn(PaymentReconcileService.prototype, 'reconcilePendingPayments').mockResolvedValue({
      total: 0,
      fixed: 0,
      failed: 0,
      skipped: 0,
    });
    const { service, prisma } = createService([
      exposureRow({ activeRefundAmount: 400n }),
    ]);

    const result = await service.reconcilePendingPayments();

    expect(prisma.paymentCompensationTask.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({
        orderNo: 'O42',
        transactionId: 'WX-TX-42',
        amount: 1000,
        reason: 'cancelled_order_paid_historical_anomaly',
        status: 'pending',
        callbackPayload: expect.objectContaining({
          orderId: '42',
          paymentId: '7',
          paidAmount: 1000,
          successfulRefundAmount: 0,
          activeRefundAmount: 400,
          outstandingAmount: 1000,
        }),
      })],
      skipDuplicates: true,
    });
    expect(result).toEqual(expect.objectContaining({
      cancelledPaidDetected: 1,
      cancelledPaidSeeded: 1,
    }));
  });

  it('reduces a new task only by refunds already confirmed SUCCESS', async () => {
    jest.spyOn(PaymentReconcileService.prototype, 'reconcilePendingPayments').mockResolvedValue({
      total: 0,
      fixed: 0,
      failed: 0,
      skipped: 0,
    });
    const { service, prisma } = createService([
      exposureRow({ successfulRefundAmount: 400n, activeRefundAmount: 600n }),
    ]);

    await service.reconcilePendingPayments();

    const payload = prisma.paymentCompensationTask.createMany.mock.calls[0][0].data[0];
    expect(payload.amount).toBe(600);
    expect(payload.callbackPayload.successfulRefundAmount).toBe(400);
    expect(payload.callbackPayload.activeRefundAmount).toBe(600);
    expect(payload.callbackPayload.outstandingAmount).toBe(600);
  });

  it('fails safe when successful refunds already cover the full paid amount', async () => {
    jest.spyOn(PaymentReconcileService.prototype, 'reconcilePendingPayments').mockResolvedValue({
      total: 0,
      fixed: 0,
      failed: 0,
      skipped: 0,
    });
    const { service, prisma } = createService([
      exposureRow({ successfulRefundAmount: 1000n }),
    ]);

    const result = await service.reconcilePendingPayments();

    expect(prisma.paymentCompensationTask.createMany).not.toHaveBeenCalled();
    expect(result.cancelledPaidDetected).toBe(0);
    expect(result.cancelledPaidSeeded).toBe(0);
  });

  it('keeps an existing task at full cash exposure while its refund is only PROCESSING', async () => {
    const { service, prisma } = createService();
    prisma.paymentCompensationTask.findMany.mockResolvedValue([{
      id: 11n,
      orderNo: 'O42',
      transactionId: 'WX-TX-42',
      amount: 1000,
      reason: 'cancelled_order_paid_historical_anomaly',
      status: 'pending',
      callbackPayload: { original: true },
    }]);
    prisma.order.findFirst.mockResolvedValue({
      id: 42n,
      orderNo: 'O42',
      status: OrderStatus.cancelled,
      payAmount: 1000,
      payment: { id: 7n, amount: 1000 },
      orderRefunds: [
        { id: 1n, status: REFUND_STATUS.PROCESSING, refundAmount: 400, outRefundNo: 'R1' },
      ],
    });

    const result = await (service as any).reconcileExistingCancelledPaidTasks();

    expect(prisma.paymentCompensationTask.updateMany).toHaveBeenCalledWith({
      where: { id: 11n, status: 'pending' },
      data: expect.objectContaining({
        amount: 1000,
        resolution: expect.stringContaining('400分退款处理中'),
        callbackPayload: expect.objectContaining({
          original: true,
          reconciliation: expect.objectContaining({
            successfulRefundAmount: 0,
            activeRefundAmount: 400,
            outstandingAmount: 1000,
          }),
        }),
      }),
    });
    expect(result.historicalTasksRefreshed).toBe(1);
    expect(result.historicalTasksResolved).toBe(0);
  });

  it('reduces an existing task after a SUCCESS refund but keeps it pending while cash remains', async () => {
    const { service, prisma } = createService();
    prisma.paymentCompensationTask.findMany.mockResolvedValue([{
      id: 12n,
      orderNo: 'O42',
      transactionId: 'WX-TX-42',
      amount: 1000,
      reason: 'cancelled_order_paid_callback',
      status: 'pending',
      callbackPayload: {},
    }]);
    prisma.order.findFirst.mockResolvedValue({
      id: 42n,
      orderNo: 'O42',
      status: OrderStatus.cancelled,
      payAmount: 1000,
      payment: { id: 7n, amount: 1000 },
      orderRefunds: [
        { id: 1n, status: REFUND_STATUS.SUCCESS, refundAmount: 400, outRefundNo: 'R1' },
        { id: 2n, status: REFUND_STATUS.CLOSED, refundAmount: 600, outRefundNo: 'R2' },
      ],
    });

    await (service as any).reconcileExistingCancelledPaidTasks();

    expect(prisma.paymentCompensationTask.updateMany).toHaveBeenCalledWith({
      where: { id: 12n, status: 'pending' },
      data: expect.objectContaining({
        amount: 600,
        resolution: expect.stringContaining('600分尚未被成功退款证明退回'),
      }),
    });
  });

  it('auto-resolves an existing task only when SUCCESS refunds cover all paid cash', async () => {
    const { service, prisma } = createService();
    prisma.paymentCompensationTask.findMany.mockResolvedValue([{
      id: 13n,
      orderNo: 'O42',
      transactionId: 'WX-TX-42',
      amount: 1000,
      reason: 'cancelled_order_paid_historical_anomaly',
      status: 'pending',
      callbackPayload: {},
    }]);
    prisma.order.findFirst.mockResolvedValue({
      id: 42n,
      orderNo: 'O42',
      status: OrderStatus.cancelled,
      payAmount: 1000,
      payment: { id: 7n, amount: 1000 },
      orderRefunds: [
        { id: 1n, status: REFUND_STATUS.SUCCESS, refundAmount: 1000, outRefundNo: 'R1' },
      ],
    });

    const result = await (service as any).reconcileExistingCancelledPaidTasks();

    expect(prisma.paymentCompensationTask.updateMany).toHaveBeenCalledWith({
      where: { id: 13n, status: 'pending' },
      data: expect.objectContaining({
        amount: 0,
        status: 'resolved',
        handledBy: 'system:historical-cancelled-paid-reconcile',
        handledAt: expect.any(Date),
        resolution: expect.stringContaining('成功退款已覆盖全部实付金额1000分'),
      }),
    });
    expect(result.historicalTasksResolved).toBe(1);
  });

  it('filters at the database layer for cancelled successful WeChat payments and existing tasks', async () => {
    jest.spyOn(PaymentReconcileService.prototype, 'reconcilePendingPayments').mockResolvedValue({
      total: 0,
      fixed: 0,
      failed: 0,
      skipped: 0,
    });
    const { service, prisma } = createService([]);

    await service.reconcilePendingPayments();

    const rawCall = prisma.$queryRaw.mock.calls[0];
    const sql = Array.from(rawCall[0] as readonly string[]).join(' ');
    const values = rawCall.slice(1);
    expect(sql).toContain('NOT EXISTS');
    expect(sql).toContain('payment_compensation_tasks');
    expect(sql).toContain('HAVING COALESCE(SUM');
    expect(values).toContain(OrderStatus.cancelled);
    expect(values).toContain(PAYMENT_STATUS.SUCCESS);
    expect(values).toContain(REFUND_STATUS.INITIATING);
    expect(values).toContain(REFUND_STATUS.PENDING);
    expect(values).toContain(REFUND_STATUS.PROCESSING);
    expect(values).toContain(REFUND_STATUS.SUCCESS);
    expect(values).toContain('cancelled_order_paid_callback');
    expect(values).toContain('cancelled_order_paid_historical_anomaly');
  });
});
