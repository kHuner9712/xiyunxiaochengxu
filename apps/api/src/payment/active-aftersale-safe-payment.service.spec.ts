import { AftersaleStatus, OrderStatus } from '@prisma/client';
import { ActiveAftersaleSafePaymentService } from './active-aftersale-safe-payment.service';
import { ConfirmedMissingRefundRetryPaymentService } from './confirmed-missing-refund-retry-payment.service';

function createService() {
  const prisma: any = {
    aftersaleOrder: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    order: {
      updateMany: jest.fn(),
    },
  };
  const config: any = { get: jest.fn(() => undefined) };
  const service = new ActiveAftersaleSafePaymentService(
    prisma,
    config,
    {} as any,
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

describe('ActiveAftersaleSafePaymentService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('re-asserts order.aftersale when another item still has an active aftersale after refund success', async () => {
    const { service, prisma } = createService();
    jest.spyOn(ConfirmedMissingRefundRetryPaymentService.prototype, 'processWechatRefundSuccess')
      .mockResolvedValue(undefined as any);
    prisma.aftersaleOrder.findFirst.mockResolvedValue({ id: 88n, status: AftersaleStatus.pending_review });
    prisma.order.updateMany.mockResolvedValue({ count: 1 });

    await service.processWechatRefundSuccess({ id: 7n, orderId: 9n }, 'WX-REFUND-1', {});

    expect(prisma.aftersaleOrder.findFirst).toHaveBeenCalledWith({
      where: {
        orderId: 9n,
        status: { in: expect.arrayContaining([AftersaleStatus.pending_review]) },
      },
      select: { id: true },
    });
    expect(prisma.order.updateMany).toHaveBeenCalledWith({
      where: {
        id: 9n,
        status: { in: [OrderStatus.delivered, OrderStatus.completed] },
      },
      data: { status: OrderStatus.aftersale },
    });
  });

  it('runs the aggregate repair even when a post-refund side effect throws', async () => {
    const { service, prisma } = createService();
    jest.spyOn(ConfirmedMissingRefundRetryPaymentService.prototype, 'processWechatRefundSuccess')
      .mockRejectedValue(new Error('peripheral side effect failed'));
    prisma.aftersaleOrder.findFirst.mockResolvedValue({ id: 99n });
    prisma.order.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      service.processWechatRefundSuccess({ id: 8n, orderId: 10n }, 'WX-REFUND-2', {}),
    ).rejects.toThrow('peripheral side effect failed');

    expect(prisma.order.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 10n }),
      data: { status: OrderStatus.aftersale },
    }));
  });

  it('does not force aftersale when no active aftersale remains', async () => {
    const { service, prisma } = createService();
    jest.spyOn(ConfirmedMissingRefundRetryPaymentService.prototype, 'processWechatRefundSuccess')
      .mockResolvedValue(undefined as any);
    prisma.aftersaleOrder.findFirst.mockResolvedValue(null);

    await service.processWechatRefundSuccess({ id: 9n, orderId: 11n }, 'WX-REFUND-3', {});

    expect(prisma.order.updateMany).not.toHaveBeenCalled();
  });
});