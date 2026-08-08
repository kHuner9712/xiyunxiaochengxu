import { jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { DurableZeroPayAftersalePaymentService } from './durable-zero-pay-aftersale-payment.service';

function createService(options: { benefitError?: Error } = {}) {
  const candidate = {
    refundId: 11n,
    orderId: 22n,
    aftersaleId: 33n,
    orderNo: 'O22',
  };
  const createdTask = {
    id: 44n,
    orderNo: candidate.orderNo,
    transactionId: 'zero-refund-effects:11',
    reason: 'zero_refund_side_effects',
    status: 'pending',
  };
  const prisma: any = {
    $queryRaw: jest.fn(async () => [candidate]),
    paymentCompensationTask: {
      findFirst: jest.fn(async () => null),
      create: jest.fn(async () => createdTask),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
  };
  const config: any = { get: jest.fn() };
  const businessEvent: any = { emit: jest.fn(), emitWarn: jest.fn(), emitCritical: jest.fn() };
  const orderService: any = {};
  const shareService: any = {};
  const benefitPackageService: any = {
    revokeAfterRefundSuccess: options.benefitError
      ? jest.fn(async () => { throw options.benefitError; })
      : jest.fn(async () => ({ packages: 1, entitlements: 1 })),
  };
  const merchantSettlementService: any = {};
  const groupBuyService: any = { handleRefundSuccess: jest.fn(async () => ({ affected: 1 })) };
  const flashSaleService: any = {};
  const redisService: any = { setNX: jest.fn(), releaseLockWithLua: jest.fn() };
  const service = new DurableZeroPayAftersalePaymentService(
    prisma,
    config,
    businessEvent,
    orderService,
    shareService,
    benefitPackageService,
    merchantSettlementService,
    groupBuyService,
    flashSaleService,
    redisService,
  );
  jest.spyOn((service as any).durableZeroPayLogger, 'error').mockImplementation(() => undefined);
  return { service, prisma, benefitPackageService, groupBuyService, createdTask };
}

describe('DurableZeroPayAftersalePaymentService', () => {
  it('resolves a durable task only after zero-pay refund side effects actually succeed', async () => {
    const { service, prisma, benefitPackageService, groupBuyService, createdTask } = createService();

    const result = await (service as any).reconcileZeroPayRefundSideEffects(10);

    expect(result).toEqual({ total: 1, resolved: 1, failed: 0 });
    expect(prisma.paymentCompensationTask.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderNo: 'O22',
        transactionId: 'zero-refund-effects:11',
        reason: 'zero_refund_side_effects',
        status: 'pending',
      }),
    });
    expect(benefitPackageService.revokeAfterRefundSuccess).toHaveBeenCalledWith(22n, 33n);
    expect(groupBuyService.handleRefundSuccess).toHaveBeenCalledWith(22n);
    expect(prisma.paymentCompensationTask.updateMany).toHaveBeenCalledWith({
      where: { id: createdTask.id, status: 'pending' },
      data: expect.objectContaining({
        status: 'resolved',
        handledBy: 'system:zero-refund-side-effects',
      }),
    });
  });

  it('keeps the durable task pending when a side effect fails', async () => {
    const { service, prisma, groupBuyService, createdTask } = createService({
      benefitError: new Error('benefit storage unavailable'),
    });

    const result = await (service as any).reconcileZeroPayRefundSideEffects(10);

    expect(result).toEqual({ total: 1, resolved: 0, failed: 1 });
    expect(groupBuyService.handleRefundSuccess).not.toHaveBeenCalled();
    expect(prisma.paymentCompensationTask.updateMany).toHaveBeenCalledWith({
      where: { id: createdTask.id, status: 'pending' },
      data: expect.objectContaining({
        handledBy: null,
        handledAt: null,
        resolution: expect.stringContaining('等待重试'),
      }),
    });
  });

  it('does not allow operators to manually close zero-pay side-effect debt', async () => {
    const { service, prisma } = createService();
    prisma.paymentCompensationTask.findFirst.mockResolvedValueOnce({
      reason: 'zero_refund_side_effects',
    });

    await expect(
      service.resolveCompensationTask('44', 'admin:1', 'manual close', 'resolved'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
