import { BadRequestException } from '@nestjs/common';
import { StockSafeRecoverableProductionPaymentService } from './stock-safe-recoverable-production-payment.service';
import { CancellationSafeStockSafePaymentService } from './cancellation-safe-stock-safe-payment.service';

describe('CancellationSafeStockSafePaymentService', () => {
  afterEach(() => jest.restoreAllMocks());

  function createService(lockAcquired = true) {
    const prisma: any = {};
    const config: any = {
      get: jest.fn((key: string, fallback?: unknown) => {
        if (key === 'NODE_ENV') return 'test';
        return fallback;
      }),
    };
    const redis: any = {
      setNX: jest.fn().mockResolvedValue(lockAcquired),
      releaseLockWithLua: jest.fn().mockResolvedValue(true),
    };
    const noop: any = {};
    const service = new CancellationSafeStockSafePaymentService(
      prisma,
      config,
      noop,
      noop,
      noop,
      noop,
      noop,
      noop,
      noop,
      redis,
    );
    return { service, redis };
  }

  it('serializes payment initialization using the same order payment-cancel lock', async () => {
    const baseCreatePayment = jest
      .spyOn(StockSafeRecoverableProductionPaymentService.prototype, 'createPayment')
      .mockResolvedValue({ orderId: '42' } as any);
    const { service, redis } = createService(true);

    await service.createPayment('42', '8');

    expect(redis.setNX).toHaveBeenCalledWith(
      'order:payment-cancel:42',
      expect.any(String),
      90,
    );
    expect(baseCreatePayment).toHaveBeenCalledWith('42', '8');
    expect(redis.releaseLockWithLua).toHaveBeenCalled();
  });

  it('fails closed when cancellation currently owns the order lock', async () => {
    const baseCreatePayment = jest.spyOn(
      StockSafeRecoverableProductionPaymentService.prototype,
      'createPayment',
    );
    const { service } = createService(false);

    await expect(service.createPayment('42', '8')).rejects.toBeInstanceOf(BadRequestException);
    expect(baseCreatePayment).not.toHaveBeenCalled();
  });
});
