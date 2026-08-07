import { OrderStatus } from '@prisma/client';
import { PAYMENT_STATUS, REFUND_STATUS } from '../common/constants';
import { PaymentReconcileService } from './payment-reconcile.service';
import { HistoricalAnomalyPaymentReconcileService } from './historical-anomaly-payment-reconcile.service';

describe('HistoricalAnomalyPaymentReconcileService', () => {
  afterEach(() => jest.restoreAllMocks());

  function createService(rows: any[]) {
    const prisma: any = {
      $queryRaw: jest.fn().mockResolvedValue(rows),
      paymentCompensationTask: {
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

  const exposureRow = (overrides: any = {}) => ({
    orderId: 42n,
    orderNo: 'O42',
    payAmount: 1000,
    paymentId: 7n,
    paymentAmount: 1000,
    transactionId: 'WX-TX-42',
    countedRefundAmount: 0,
    ...overrides,
  });

  it('seeds a durable manual task for cancelled WeChat SUCCESS exposure', async () => {
    jest.spyOn(PaymentReconcileService.prototype, 'reconcilePendingPayments').mockResolvedValue({
      total: 0,
      fixed: 0,
      failed: 0,
      skipped: 0,
    });
    const { service, prisma } = createService([exposureRow()]);

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
          countedRefundAmount: 0,
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

  it('records only the still-unrefunded balance after a partial refund', async () => {
    jest.spyOn(PaymentReconcileService.prototype, 'reconcilePendingPayments').mockResolvedValue({
      total: 0,
      fixed: 0,
      failed: 0,
      skipped: 0,
    });
    const { service, prisma } = createService([
      exposureRow({ countedRefundAmount: 400n }),
    ]);

    await service.reconcilePendingPayments();

    const payload = prisma.paymentCompensationTask.createMany.mock.calls[0][0].data[0];
    expect(payload.amount).toBe(600);
    expect(payload.callbackPayload.countedRefundAmount).toBe(400);
    expect(payload.callbackPayload.outstandingAmount).toBe(600);
  });

  it('fails safe when a defensive row is already fully covered by refunds', async () => {
    jest.spyOn(PaymentReconcileService.prototype, 'reconcilePendingPayments').mockResolvedValue({
      total: 0,
      fixed: 0,
      failed: 0,
      skipped: 0,
    });
    const { service, prisma } = createService([
      exposureRow({ countedRefundAmount: 1000n }),
    ]);

    const result = await service.reconcilePendingPayments();

    expect(prisma.paymentCompensationTask.createMany).not.toHaveBeenCalled();
    expect(result.cancelledPaidDetected).toBe(0);
    expect(result.cancelledPaidSeeded).toBe(0);
  });

  it('filters at the database layer for cancelled successful WeChat payments and existing callback tasks', async () => {
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
