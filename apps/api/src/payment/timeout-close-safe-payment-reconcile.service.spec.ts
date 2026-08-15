import { OrderStatus } from '@prisma/client';
import { PAYMENT_STATUS } from '../common/constants';
import { TimeoutCloseSafeHistoricalAnomalyPaymentReconcileService } from './timeout-close-safe-payment-reconcile.service';

describe('TimeoutCloseSafeHistoricalAnomalyPaymentReconcileService', () => {
  function createService() {
    const prisma: any = {
      order: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      orderPayment: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue({ status: PAYMENT_STATUS.CREATED }),
      },
    };
    const paymentService: any = {
      isPaymentStatusSyncAvailable: jest.fn().mockReturnValue(true),
      queryWechatOrder: jest.fn(),
      processPaymentSuccess: jest.fn().mockResolvedValue(undefined),
      closeWechatOrderForCancellation: jest.fn().mockResolvedValue(undefined),
    };
    const businessEvent: any = {
      emitInfo: jest.fn(),
      emitWarn: jest.fn(),
      emitError: jest.fn(),
      emitCritical: jest.fn(),
    };
    const service = new TimeoutCloseSafeHistoricalAnomalyPaymentReconcileService(
      prisma,
      paymentService,
      businessEvent,
    );
    return { service, prisma, paymentService };
  }

  function timeoutOrder() {
    return {
      id: 10n,
      orderNo: 'ORDER-10',
      status: OrderStatus.pending_payment,
      autoCloseAt: new Date(Date.now() - 60_000),
      payment: {
        id: 20n,
        status: PAYMENT_STATUS.CREATED,
      },
    };
  }

  it('marks a remotely CLOSED created payment failed so the following auto-close pass can cancel it', async () => {
    const { service, prisma, paymentService } = createService();
    prisma.order.findMany.mockResolvedValue([timeoutOrder()]);
    paymentService.queryWechatOrder.mockResolvedValue({ trade_state: 'CLOSED' });

    const result = await service.confirmTimeoutOrdersBeforeClose();

    expect(prisma.orderPayment.updateMany).toHaveBeenCalledWith({
      where: { id: 20n, status: PAYMENT_STATUS.CREATED },
      data: expect.objectContaining({
        status: PAYMENT_STATUS.FAILED,
        rawResponse: expect.objectContaining({
          detector: 'timeout-order-close-confirmation',
          terminalState: 'CLOSED',
        }),
      }),
    });
    expect(result).toEqual({ total: 1, fixed: 0, delayed: 0, closable: 1, failed: 0 });
  });

  it('closes a remote NOTPAY order before marking the local payment failed', async () => {
    const { service, prisma, paymentService } = createService();
    prisma.order.findMany.mockResolvedValue([timeoutOrder()]);
    paymentService.queryWechatOrder.mockResolvedValue({ trade_state: 'NOTPAY' });

    const result = await service.confirmTimeoutOrdersBeforeClose();

    expect(paymentService.closeWechatOrderForCancellation).toHaveBeenCalledWith('ORDER-10');
    expect(prisma.orderPayment.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 20n, status: PAYMENT_STATUS.CREATED },
      data: expect.objectContaining({
        status: PAYMENT_STATUS.FAILED,
        rawResponse: expect.objectContaining({ terminalState: 'CLOSED_BY_MERCHANT' }),
      }),
    }));
    expect(result).toEqual({ total: 1, fixed: 0, delayed: 0, closable: 1, failed: 0 });
  });

  it('re-queries after a close race and processes payment success instead of cancelling the order', async () => {
    const { service, prisma, paymentService } = createService();
    prisma.order.findMany.mockResolvedValue([timeoutOrder()]);
    paymentService.queryWechatOrder
      .mockResolvedValueOnce({ trade_state: 'NOTPAY' })
      .mockResolvedValueOnce({
        trade_state: 'SUCCESS',
        transaction_id: 'WX-TX-10',
        amount: { total: 1999 },
      });
    paymentService.closeWechatOrderForCancellation.mockRejectedValueOnce(new Error('ORDERPAID'));

    const result = await service.confirmTimeoutOrdersBeforeClose();

    expect(paymentService.processPaymentSuccess).toHaveBeenCalledWith(
      20n,
      10n,
      'WX-TX-10',
      1999,
      expect.objectContaining({ orderNo: 'ORDER-10' }),
    );
    expect(prisma.orderPayment.updateMany).not.toHaveBeenCalled();
    expect(result).toEqual({ total: 1, fixed: 1, delayed: 0, closable: 0, failed: 0 });
  });

  it('keeps CREATED and delays auto-close when remote close and re-query cannot establish a terminal fact', async () => {
    const { service, prisma, paymentService } = createService();
    prisma.order.findMany.mockResolvedValue([timeoutOrder()]);
    paymentService.queryWechatOrder
      .mockResolvedValueOnce({ trade_state: 'NOTPAY' })
      .mockResolvedValueOnce({ trade_state: 'USERPAYING' });
    paymentService.closeWechatOrderForCancellation.mockRejectedValueOnce(new Error('busy'));

    const result = await service.confirmTimeoutOrdersBeforeClose();

    expect(prisma.orderPayment.updateMany).not.toHaveBeenCalled();
    expect(prisma.order.updateMany).toHaveBeenCalledWith({
      where: { id: 10n, status: OrderStatus.pending_payment },
      data: { autoCloseAt: expect.any(Date) },
    });
    expect(result).toEqual({ total: 1, fixed: 0, delayed: 1, closable: 0, failed: 1 });
  });
});
