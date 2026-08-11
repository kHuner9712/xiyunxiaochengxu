import { OrderStatus } from '@prisma/client';
import { PAYMENT_STATUS, REFUND_STATUS } from '../common/constants';
import { PaymentReconcileService } from './payment-reconcile.service';

describe('PaymentReconcileService batch safety', () => {
  function createService() {
    const prisma: any = {
      orderPayment: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      orderRefund: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      order: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const paymentService: any = {
      isPaymentStatusSyncAvailable: jest.fn().mockReturnValue(true),
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
    return { service, prisma };
  }

  it('bounds stale created-payment and half-success scans to stable 20-row batches', async () => {
    const { service, prisma } = createService();

    await service.reconcilePendingPayments();

    expect(prisma.orderPayment.findMany).toHaveBeenNthCalledWith(1, {
      where: {
        status: PAYMENT_STATUS.CREATED,
        createdAt: { lt: expect.any(Date) },
      },
      include: { order: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
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

  it('bounds stale active-refund scans to a stable 20-row batch', async () => {
    const { service, prisma } = createService();

    await service.reconcilePendingRefunds();

    expect(prisma.orderRefund.findMany).toHaveBeenCalledWith({
      where: {
        status: {
          in: [
            REFUND_STATUS.INITIATING,
            REFUND_STATUS.PENDING,
            REFUND_STATUS.PROCESSING,
          ],
        },
        updatedAt: { lt: expect.any(Date) },
      },
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: 20,
    });
  });
});
