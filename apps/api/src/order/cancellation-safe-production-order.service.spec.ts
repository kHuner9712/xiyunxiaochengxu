import { BadRequestException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { ProductionOrderService } from './production-order.service';
import { CancellationSafeProductionOrderService } from './cancellation-safe-production-order.service';

describe('CancellationSafeProductionOrderService', () => {
  afterEach(() => jest.restoreAllMocks());

  function createService(payment: any) {
    const prisma: any = {
      order: {
        findUnique: jest.fn().mockResolvedValue({ status: OrderStatus.pending_payment }),
      },
      orderPayment: {
        findFirst: jest.fn().mockResolvedValue(payment),
      },
    };
    const redis: any = {
      setNX: jest.fn().mockResolvedValue(true),
      releaseLockWithLua: jest.fn().mockResolvedValue(true),
    };
    const noop: any = {};
    const service = new CancellationSafeProductionOrderService(
      prisma,
      noop,
      noop,
      noop,
      noop,
      redis,
    );
    return { service, prisma, redis };
  }

  it('blocks user cancellation after a payment record exists', async () => {
    const baseCancel = jest.spyOn(ProductionOrderService.prototype, 'cancel').mockResolvedValue({} as any);
    const { service, redis } = createService({ id: 7n, status: 1 });

    await expect(service.cancel('42', '8', '不想买了')).rejects.toBeInstanceOf(BadRequestException);

    expect(baseCancel).not.toHaveBeenCalled();
    expect(redis.setNX).toHaveBeenCalledWith(
      'order:payment-cancel:42',
      expect.any(String),
      90,
    );
    expect(redis.releaseLockWithLua).toHaveBeenCalled();
  });

  it('allows cancellation under the same lock when no payment was ever initialized', async () => {
    const baseCancel = jest
      .spyOn(ProductionOrderService.prototype, 'cancel')
      .mockResolvedValue({ id: '42', status: OrderStatus.cancelled } as any);
    const { service } = createService(null);

    await service.cancel('42', '8', '不想买了');

    expect(baseCancel).toHaveBeenCalledWith('42', '8', '不想买了');
  });
});
