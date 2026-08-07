import { PAYMENT_STATUS, REFUND_STATUS } from '../common/constants';
import { PaymentReconcileService } from './payment-reconcile.service';
import { ProductionPaymentReconcileService } from './production-payment-reconcile.service';

describe('ProductionPaymentReconcileService', () => {
  function createService() {
    const order = {
      id: 42n,
      orderNo: 'O42',
      status: 'pending_payment',
      autoCloseAt: new Date(Date.now() - 60_000),
      payment: {
        id: 7n,
        status: PAYMENT_STATUS.CREATED,
        transactionId: null,
      },
    };
    const prisma: any = {
      order: {
        findMany: jest.fn().mockResolvedValue([order]),
        update: jest.fn().mockResolvedValue({}),
      },
      orderPayment: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      orderRefund: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      orderLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const paymentService: any = {
      isPaymentStatusSyncAvailable: jest.fn().mockReturnValue(true),
      queryWechatOrder: jest.fn(),
      processPaymentSuccess: jest.fn().mockResolvedValue(undefined),
      closeWechatOrderForCancellation: jest.fn().mockResolvedValue(undefined),
      syncRefund: jest.fn(),
    };
    const event: any = { emitWarn: jest.fn() };
    const service = new ProductionPaymentReconcileService(prisma, paymentService, event);
    return { service, prisma, paymentService, order };
  }

  afterEach(() => jest.restoreAllMocks());

  it('closes the remote WeChat NOTPAY transaction before declaring the order locally closable', async () => {
    const { service, prisma, paymentService } = createService();
    paymentService.queryWechatOrder.mockResolvedValue({ trade_state: 'NOTPAY' });

    const result = await service.confirmTimeoutOrdersBeforeClose();

    expect(paymentService.closeWechatOrderForCancellation).toHaveBeenCalledWith('O42');
    expect(prisma.orderPayment.updateMany).toHaveBeenCalledWith({
      where: { id: 7n, status: { not: PAYMENT_STATUS.SUCCESS } },
      data: expect.objectContaining({ status: PAYMENT_STATUS.FAILED }),
    });
    expect(result.closable).toBe(1);
    expect(result.fixed).toBe(0);
  });

  it('treats payment success found after a close failure as paid instead of cancelling locally', async () => {
    const { service, prisma, paymentService } = createService();
    paymentService.queryWechatOrder
      .mockResolvedValueOnce({ trade_state: 'NOTPAY' })
      .mockResolvedValueOnce({
        trade_state: 'SUCCESS',
        transaction_id: 'WX-TX-1',
        amount: { total: 1000 },
      });
    paymentService.closeWechatOrderForCancellation.mockRejectedValueOnce(
      new Error('close raced with payment'),
    );

    const result = await service.confirmTimeoutOrdersBeforeClose();

    expect(paymentService.processPaymentSuccess).toHaveBeenCalledWith(
      7n,
      42n,
      'WX-TX-1',
      1000,
      expect.objectContaining({ id: 42n }),
    );
    expect(prisma.orderPayment.updateMany).not.toHaveBeenCalled();
    expect(result.fixed).toBe(1);
    expect(result.closable).toBe(0);
  });

  it('fails safe and delays closing when payment status cannot be verified', async () => {
    const { service, prisma, paymentService } = createService();
    paymentService.queryWechatOrder.mockRejectedValue(
      Object.assign(new Error('wechat unavailable'), { response: { data: { code: 'SYSTEM_ERROR' } } }),
    );

    const result = await service.confirmTimeoutOrdersBeforeClose();

    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 42n },
      data: { autoCloseAt: expect.any(Date) },
    });
    expect(result.delayed).toBe(1);
    expect(result.closable).toBe(0);
  });

  it('allows local close when WeChat authoritatively reports that the order never existed', async () => {
    const { service, prisma, paymentService } = createService();
    paymentService.queryWechatOrder.mockRejectedValue(
      Object.assign(new Error('not found'), { response: { data: { code: 'ORDER_NOT_EXIST' } } }),
    );

    const result = await service.confirmTimeoutOrdersBeforeClose();

    expect(prisma.orderPayment.updateMany).toHaveBeenCalledWith({
      where: { id: 7n, status: { not: PAYMENT_STATUS.SUCCESS } },
      data: expect.objectContaining({ status: PAYMENT_STATUS.FAILED }),
    });
    expect(result.closable).toBe(1);
  });

  it('automatically observes stale abnormal refunds and counts recovered terminal states', async () => {
    const { service, prisma, paymentService } = createService();
    jest.spyOn(PaymentReconcileService.prototype, 'reconcilePendingRefunds').mockResolvedValue({
      total: 2,
      fixed: 1,
      failed: 0,
      skipped: 1,
    });
    prisma.orderRefund.findMany.mockResolvedValue([
      { id: 1n, outRefundNo: 'OR-A' },
      { id: 2n, outRefundNo: 'OR-B' },
      { id: 3n, outRefundNo: 'OR-C' },
    ]);
    paymentService.syncRefund
      .mockResolvedValueOnce({ synced: true, status: REFUND_STATUS.SUCCESS })
      .mockResolvedValueOnce({ synced: false, status: REFUND_STATUS.ABNORMAL })
      .mockResolvedValueOnce({ synced: true, status: REFUND_STATUS.CLOSED });

    const result = await service.reconcilePendingRefunds();

    expect(prisma.orderRefund.findMany).toHaveBeenCalledWith({
      where: {
        status: REFUND_STATUS.ABNORMAL,
        updatedAt: { lt: expect.any(Date) },
      },
      orderBy: { updatedAt: 'asc' },
      take: 100,
      select: { id: true, outRefundNo: true },
    });
    expect(paymentService.syncRefund).toHaveBeenNthCalledWith(1, 'OR-A');
    expect(paymentService.syncRefund).toHaveBeenNthCalledWith(2, 'OR-B');
    expect(paymentService.syncRefund).toHaveBeenNthCalledWith(3, 'OR-C');
    expect(result).toEqual(expect.objectContaining({
      total: 2,
      fixed: 1,
      abnormalTotal: 3,
      abnormalRecovered: 2,
      abnormalStillAbnormal: 1,
      abnormalFailed: 0,
    }));
  });

  it('isolates a failed abnormal-refund observation instead of aborting the whole batch', async () => {
    const { service, prisma, paymentService } = createService();
    jest.spyOn(PaymentReconcileService.prototype, 'reconcilePendingRefunds').mockResolvedValue({
      total: 0,
      fixed: 0,
      failed: 0,
      skipped: 0,
    });
    prisma.orderRefund.findMany.mockResolvedValue([
      { id: 1n, outRefundNo: 'OR-A' },
      { id: 2n, outRefundNo: 'OR-B' },
    ]);
    paymentService.syncRefund
      .mockRejectedValueOnce(new Error('wechat unavailable'))
      .mockResolvedValueOnce({ synced: true, status: REFUND_STATUS.PENDING });

    const result = await service.reconcilePendingRefunds();

    expect(paymentService.syncRefund).toHaveBeenCalledTimes(2);
    expect(result.abnormalFailed).toBe(1);
    expect(result.abnormalRecovered).toBe(1);
  });
});
