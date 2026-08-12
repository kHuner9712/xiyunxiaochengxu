import { OrderStatus } from '@prisma/client';
import { PAYMENT_STATUS, REFUND_STATUS } from '../common/constants';
import { PaymentReconcileService } from './payment-reconcile.service';

describe('PaymentReconcileService batch safety', () => {
  function createService() {
    const prisma: any = {
      orderPayment: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      orderRefund: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      aftersaleOrder: {
        update: jest.fn().mockResolvedValue({}),
      },
      order: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    prisma.$transaction = jest.fn(async (callback: any) => callback(prisma));

    const paymentService: any = {
      isPaymentStatusSyncAvailable: jest.fn().mockReturnValue(true),
      queryWechatOrder: jest.fn(),
      queryRefund: jest.fn(),
      processPaymentSuccess: jest.fn().mockResolvedValue(undefined),
      processWechatRefundSuccess: jest.fn().mockResolvedValue(undefined),
    };
    const businessEvent: any = {
      emitInfo: jest.fn(),
      emitWarn: jest.fn(),
    };
    const service = new PaymentReconcileService(
      prisma,
      paymentService,
      businessEvent,
    );
    return { service, prisma, paymentService };
  }

  it('bounds active created-payment and half-success scans to stable 20-row batches', async () => {
    const { service, prisma } = createService();

    await service.reconcilePendingPayments();

    expect(prisma.orderPayment.findMany).toHaveBeenNthCalledWith(1, {
      where: {
        status: PAYMENT_STATUS.CREATED,
        createdAt: { lt: expect.any(Date) },
        order: { status: OrderStatus.pending_payment },
      },
      include: { order: true },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: 20,
    });
    expect(prisma.orderPayment.findMany).toHaveBeenNthCalledWith(2, {
      where: {
        status: PAYMENT_STATUS.SUCCESS,
        order: { status: OrderStatus.pending_payment },
      },
      include: { order: true },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: 20,
    });
  });

  it('rotates a still-pending payment attempt so later rows cannot starve', async () => {
    const { service, prisma, paymentService } = createService();
    prisma.orderPayment.findMany
      .mockResolvedValueOnce([{
        id: 7n,
        status: PAYMENT_STATUS.CREATED,
        order: { id: 9n, orderNo: 'O9', status: OrderStatus.pending_payment },
      }])
      .mockResolvedValueOnce([]);
    paymentService.queryWechatOrder.mockResolvedValue({ trade_state: 'USERPAYING' });

    await service.reconcilePendingPayments();

    expect(prisma.orderPayment.updateMany).toHaveBeenCalledWith({
      where: { id: 7n, status: PAYMENT_STATUS.CREATED },
      data: { updatedAt: expect.any(Date) },
    });
  });

  it('bounds timeout-order payment confirmation to a stable 20-row batch', async () => {
    const { service, prisma } = createService();

    await service.confirmTimeoutOrdersBeforeClose();

    expect(prisma.order.findMany).toHaveBeenCalledWith({
      where: {
        status: OrderStatus.pending_payment,
        autoCloseAt: { lte: expect.any(Date) },
      },
      include: { payment: true },
      orderBy: [{ autoCloseAt: 'asc' }, { id: 'asc' }],
      take: 20,
    });
  });

  it('bounds stale active and ambiguous refund scans to a stable 20-row batch', async () => {
    const { service, prisma } = createService();

    await service.reconcilePendingRefunds();

    expect(prisma.orderRefund.findMany).toHaveBeenCalledWith({
      where: {
        status: {
          in: [
            REFUND_STATUS.INITIATING,
            REFUND_STATUS.PENDING,
            REFUND_STATUS.PROCESSING,
            REFUND_STATUS.FAILED,
            REFUND_STATUS.RETRYING,
          ],
        },
        updatedAt: { lt: expect.any(Date) },
      },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: 20,
    });
  });

  it('rotates a WeChat PROCESSING refund to the back of the finite queue', async () => {
    const { service, prisma, paymentService } = createService();
    const wechatResult = {
      status: 'PROCESSING',
      refund_id: 'WX-R-1',
    };
    prisma.orderRefund.findMany.mockResolvedValue([{
      id: 11n,
      outRefundNo: 'OR-11',
      refundId: 'WX-R-1',
      refundAmount: 100,
      aftersaleId: null,
      status: REFUND_STATUS.PENDING,
    }]);
    paymentService.queryRefund.mockResolvedValue(wechatResult);

    await service.reconcilePendingRefunds();

    expect(prisma.orderRefund.updateMany).toHaveBeenCalledWith({
      where: {
        id: 11n,
        status: {
          in: [
            REFUND_STATUS.INITIATING,
            REFUND_STATUS.PENDING,
            REFUND_STATUS.PROCESSING,
            REFUND_STATUS.FAILED,
            REFUND_STATUS.RETRYING,
          ],
        },
      },
      data: {
        updatedAt: expect.any(Date),
        rawResponse: wechatResult,
      },
    });
  });

  it('recovers an ambiguous FAILED refund to PENDING when WeChat says PROCESSING', async () => {
    const { service, prisma, paymentService } = createService();
    const wechatResult = {
      status: 'PROCESSING',
      refund_id: 'WX-R-FAILED',
    };
    prisma.orderRefund.findMany.mockResolvedValue([{
      id: 12n,
      outRefundNo: 'OR-12',
      refundId: null,
      refundAmount: 200,
      aftersaleId: 22n,
      status: REFUND_STATUS.FAILED,
    }]);
    paymentService.queryRefund.mockResolvedValue(wechatResult);

    const result = await service.reconcilePendingRefunds();

    expect(prisma.orderRefund.updateMany).toHaveBeenCalledWith({
      where: { id: 12n, status: REFUND_STATUS.FAILED },
      data: {
        status: REFUND_STATUS.PENDING,
        refundId: 'WX-R-FAILED',
        rawResponse: wechatResult,
      },
    });
    expect(result).toEqual({ total: 1, fixed: 1, failed: 0, skipped: 0 });
  });

  it('does not overwrite a newer callback result with a stale CLOSED reconcile response', async () => {
    const { service, prisma, paymentService } = createService();
    prisma.orderRefund.findMany.mockResolvedValue([{
      id: 13n,
      outRefundNo: 'OR-13',
      refundId: 'WX-R-13',
      refundAmount: 300,
      aftersaleId: 23n,
      status: REFUND_STATUS.PENDING,
    }]);
    paymentService.queryRefund.mockResolvedValue({ status: 'CLOSED' });
    // Simulate a SUCCESS callback winning the race after the remote query but before the local write.
    prisma.orderRefund.updateMany.mockResolvedValueOnce({ count: 0 });

    const result = await service.reconcilePendingRefunds();

    expect(prisma.orderRefund.updateMany).toHaveBeenCalledWith({
      where: {
        id: 13n,
        status: {
          in: [
            REFUND_STATUS.INITIATING,
            REFUND_STATUS.PENDING,
            REFUND_STATUS.PROCESSING,
            REFUND_STATUS.FAILED,
            REFUND_STATUS.RETRYING,
          ],
        },
      },
      data: { status: REFUND_STATUS.CLOSED, rawResponse: { status: 'CLOSED' } },
    });
    expect(prisma.aftersaleOrder.update).not.toHaveBeenCalled();
    expect(result).toEqual({ total: 1, fixed: 0, failed: 0, skipped: 1 });
  });
});
