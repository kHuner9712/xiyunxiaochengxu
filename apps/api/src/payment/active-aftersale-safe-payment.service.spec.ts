import { BadRequestException } from '@nestjs/common';
import { AftersaleStatus, OrderStatus } from '@prisma/client';
import { ActiveAftersaleSafePaymentService } from './active-aftersale-safe-payment.service';
import { ConfirmedMissingRefundRetryPaymentService } from './confirmed-missing-refund-retry-payment.service';

function createService(redisOverrides: Record<string, any> = {}) {
  const prisma: any = {
    aftersaleOrder: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    order: {
      updateMany: jest.fn(),
    },
  };
  const redis: any = {
    setNX: jest.fn().mockResolvedValue(true),
    extendLockWithLua: jest.fn().mockResolvedValue(true),
    releaseLockWithLua: jest.fn().mockResolvedValue(true),
    ...redisOverrides,
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
    redis,
  );
  return { service, prisma, redis };
}

describe('ActiveAftersaleSafePaymentService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('serializes ordinary refunds by order until the durable refund attempt is submitted', async () => {
    const { service, redis } = createService();
    const baseCreateRefund = jest
      .spyOn(ConfirmedMissingRefundRetryPaymentService.prototype, 'createRefund')
      .mockResolvedValue({ refundId: '7', refundNo: 'R7', outRefundNo: 'OR7' } as any);

    await expect(service.createRefund({
      orderId: '42',
      aftersaleId: '9',
      refundAmount: 1200,
      reason: '售后退款',
    })).resolves.toEqual({ refundId: '7', refundNo: 'R7', outRefundNo: 'OR7' });

    expect(redis.setNX).toHaveBeenCalledWith(
      'payment:refund-order:42',
      expect.any(String),
      300,
    );
    expect(baseCreateRefund).toHaveBeenCalledTimes(1);
    expect(redis.releaseLockWithLua).toHaveBeenCalledWith(
      'payment:refund-order:42',
      expect.any(String),
    );
  });

  it('fails closed when another refund already owns the same order lock', async () => {
    const { service, redis } = createService({
      setNX: jest.fn().mockResolvedValue(false),
    });
    const baseCreateRefund = jest
      .spyOn(ConfirmedMissingRefundRetryPaymentService.prototype, 'createRefund')
      .mockRejectedValue(new Error('must not submit a second refund'));

    await expect(service.createRefund({
      orderId: '42',
      aftersaleId: '10',
      refundAmount: 800,
      reason: '另一笔售后退款',
    })).rejects.toBeInstanceOf(BadRequestException);

    expect(baseCreateRefund).not.toHaveBeenCalled();
    expect(redis.releaseLockWithLua).not.toHaveBeenCalled();
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