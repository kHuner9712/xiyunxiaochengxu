import { PAYMENT_STATUS } from '../common/constants';
import { HistoricalAnomalyPaymentReconcileService } from './historical-anomaly-payment-reconcile.service';

describe('HistoricalAnomalyPaymentReconcileService cancelled CREATED payments', () => {
  function createService(rows: any[] = []) {
    const prisma: any = {
      $queryRaw: jest.fn().mockResolvedValue(rows),
      orderPayment: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      paymentCompensationTask: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    prisma.$transaction = jest.fn(async (callback: any) => callback(prisma));

    const paymentService: any = {
      isPaymentStatusSyncAvailable: jest.fn().mockReturnValue(true),
      queryWechatOrder: jest.fn(),
      closeWechatOrderForCancellation: jest.fn().mockResolvedValue(undefined),
    };
    const service = new HistoricalAnomalyPaymentReconcileService(
      prisma,
      paymentService,
      {} as any,
    );
    return { service, prisma, paymentService };
  }

  const candidate = (overrides: any = {}) => ({
    orderId: 42n,
    orderNo: 'O42',
    payAmount: 1000,
    paymentId: 7n,
    paymentAmount: 1000,
    paymentUpdatedAt: new Date('2026-08-01T00:00:00Z'),
    ...overrides,
  });

  it('synchronizes authoritative WeChat SUCCESS without reactivating or refunding the cancelled order', async () => {
    const { service, prisma, paymentService } = createService([candidate()]);
    paymentService.queryWechatOrder.mockResolvedValue({
      trade_state: 'SUCCESS',
      transaction_id: 'WX-TX-42',
      amount: { total: 1000 },
      success_time: '2026-08-01T12:00:00+08:00',
    });

    const result = await (service as any).reconcileCancelledCreatedPayments();

    expect(prisma.orderPayment.updateMany).toHaveBeenCalledWith({
      where: { id: 7n, status: PAYMENT_STATUS.CREATED },
      data: expect.objectContaining({
        status: PAYMENT_STATUS.SUCCESS,
        transactionId: 'WX-TX-42',
        paidAt: new Date('2026-08-01T04:00:00.000Z'),
      }),
    });
    expect(prisma.paymentCompensationTask.createMany).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({
      cancelledCreatedChecked: 1,
      cancelledCreatedSuccess: 1,
      cancelledCreatedClosed: 0,
      cancelledCreatedMismatch: 0,
    }));
  });

  it('closes remote NOTPAY before marking the historical local payment FAILED', async () => {
    const { service, prisma, paymentService } = createService([candidate()]);
    paymentService.queryWechatOrder.mockResolvedValue({ trade_state: 'NOTPAY' });

    const result = await (service as any).reconcileCancelledCreatedPayments();

    expect(paymentService.closeWechatOrderForCancellation).toHaveBeenCalledWith('O42');
    expect(prisma.orderPayment.updateMany).toHaveBeenCalledWith({
      where: { id: 7n, status: PAYMENT_STATUS.CREATED },
      data: expect.objectContaining({
        status: PAYMENT_STATUS.FAILED,
        rawResponse: expect.objectContaining({ terminalState: 'CLOSED_BY_MERCHANT' }),
      }),
    });
    expect(result.cancelledCreatedClosed).toBe(1);
  });

  it('re-queries after close failure and treats raced SUCCESS as paid instead of FAILED', async () => {
    const { service, prisma, paymentService } = createService([candidate()]);
    paymentService.queryWechatOrder
      .mockResolvedValueOnce({ trade_state: 'NOTPAY' })
      .mockResolvedValueOnce({
        trade_state: 'SUCCESS',
        transaction_id: 'WX-RACED',
        amount: { total: 1000 },
      });
    paymentService.closeWechatOrderForCancellation.mockRejectedValueOnce(new Error('close raced'));

    const result = await (service as any).reconcileCancelledCreatedPayments();

    expect(prisma.orderPayment.updateMany).toHaveBeenCalledWith({
      where: { id: 7n, status: PAYMENT_STATUS.CREATED },
      data: expect.objectContaining({
        status: PAYMENT_STATUS.SUCCESS,
        transactionId: 'WX-RACED',
      }),
    });
    const failedWrite = prisma.orderPayment.updateMany.mock.calls.find(
      ([arg]: any[]) => arg?.data?.status === PAYMENT_STATUS.FAILED,
    );
    expect(failedWrite).toBeUndefined();
    expect(result.cancelledCreatedSuccess).toBe(1);
  });

  it('keeps USERPAYING as CREATED and only rotates the observation', async () => {
    const { service, prisma, paymentService } = createService([candidate()]);
    paymentService.queryWechatOrder.mockResolvedValue({ trade_state: 'USERPAYING' });

    const result = await (service as any).reconcileCancelledCreatedPayments();

    expect(prisma.orderPayment.updateMany).toHaveBeenCalledWith({
      where: { id: 7n, status: PAYMENT_STATUS.CREATED },
      data: {
        rawResponse: expect.objectContaining({
          state: 'USERPAYING',
          detector: 'historical-cancelled-created-payment',
        }),
      },
    });
    expect(result.cancelledCreatedPending).toBe(1);
    expect(result.cancelledCreatedClosed).toBe(0);
    expect(result.cancelledCreatedSuccess).toBe(0);
  });

  it('marks CREATED failed when WeChat authoritatively reports ORDER_NOT_EXIST', async () => {
    const { service, prisma, paymentService } = createService([candidate()]);
    paymentService.queryWechatOrder.mockRejectedValue(
      Object.assign(new Error('not found'), {
        response: { data: { code: 'ORDER_NOT_EXIST' } },
      }),
    );

    const result = await (service as any).reconcileCancelledCreatedPayments();

    expect(prisma.orderPayment.updateMany).toHaveBeenCalledWith({
      where: { id: 7n, status: PAYMENT_STATUS.CREATED },
      data: expect.objectContaining({
        status: PAYMENT_STATUS.FAILED,
        rawResponse: expect.objectContaining({ terminalState: 'ORDER_NOT_EXIST' }),
      }),
    });
    expect(result.cancelledCreatedClosed).toBe(1);
  });

  it('synchronizes mismatch payment fact and manual task in one Prisma transaction', async () => {
    const { service, prisma, paymentService } = createService([candidate()]);
    paymentService.queryWechatOrder.mockResolvedValue({
      trade_state: 'SUCCESS',
      transaction_id: 'WX-MISMATCH',
      amount: { total: 1200 },
    });

    const result = await (service as any).reconcileCancelledCreatedPayments();

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.orderPayment.updateMany).toHaveBeenCalledWith({
      where: { id: 7n, status: PAYMENT_STATUS.CREATED },
      data: expect.objectContaining({
        status: PAYMENT_STATUS.SUCCESS,
        transactionId: 'WX-MISMATCH',
      }),
    });
    expect(prisma.paymentCompensationTask.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({
        orderNo: 'O42',
        transactionId: 'WX-MISMATCH',
        amount: 1200,
        reason: 'cancelled_order_paid_amount_mismatch',
        status: 'pending',
        callbackPayload: expect.objectContaining({
          expectedAmount: 1000,
          wechatAmount: 1200,
        }),
      })],
      skipDuplicates: true,
    });
    expect(result.cancelledCreatedMismatch).toBe(1);
    expect(result.cancelledCreatedSuccess).toBe(0);
  });

  it('does not perform a non-transactional SUCCESS write when mismatch task creation fails', async () => {
    const { service, prisma, paymentService } = createService([candidate()]);
    paymentService.queryWechatOrder.mockResolvedValue({
      trade_state: 'SUCCESS',
      transaction_id: 'WX-MISMATCH-FAIL',
      amount: { total: 1200 },
    });

    const txOrderPayment = { updateMany: jest.fn().mockResolvedValue({ count: 1 }) };
    const txTask = { createMany: jest.fn().mockRejectedValue(new Error('task write failed')) };
    prisma.$transaction.mockImplementationOnce(async (callback: any) => callback({
      orderPayment: txOrderPayment,
      paymentCompensationTask: txTask,
    }));

    const result = await (service as any).reconcileCancelledCreatedPayments();

    expect(txOrderPayment.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: PAYMENT_STATUS.SUCCESS }),
    }));
    expect(txTask.createMany).toHaveBeenCalled();
    const outerSuccessWrite = prisma.orderPayment.updateMany.mock.calls.find(
      ([arg]: any[]) => arg?.data?.status === PAYMENT_STATUS.SUCCESS,
    );
    expect(outerSuccessWrite).toBeUndefined();
    expect(prisma.orderPayment.updateMany).toHaveBeenCalledWith({
      where: { id: 7n, status: PAYMENT_STATUS.CREATED },
      data: {
        rawResponse: expect.objectContaining({
          state: 'query_failed',
          error: 'task write failed',
        }),
      },
    });
    expect(result.cancelledCreatedFailed).toBe(1);
    expect(result.cancelledCreatedPending).toBe(1);
    expect(result.cancelledCreatedMismatch).toBe(0);
  });
});
