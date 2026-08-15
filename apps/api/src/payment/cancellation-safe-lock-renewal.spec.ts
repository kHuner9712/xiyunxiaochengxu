import { BadRequestException } from '@nestjs/common';
import { CancellationSafeStockSafePaymentService } from './cancellation-safe-stock-safe-payment.service';

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
    extendLockWithLua: jest.fn().mockResolvedValue(true),
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

describe('CancellationSafeStockSafePaymentService renewing Redis locks', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('renews a long-running lease before its TTL expires', async () => {
    jest.useFakeTimers();
    const { service, redis } = createService(true);
    let resolveAction!: (value: string) => void;

    const pending = (service as any).withRenewingRedisLock(
      'order:payment-cancel:42',
      3,
      'busy',
      () => new Promise<string>((resolve) => {
        resolveAction = resolve;
      }),
    );

    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(1000);

    expect(redis.extendLockWithLua).toHaveBeenCalledWith(
      'order:payment-cancel:42',
      expect.any(String),
      3,
    );

    resolveAction('done');
    await expect(pending).resolves.toBe('done');
    expect(redis.releaseLockWithLua).toHaveBeenCalledWith(
      'order:payment-cancel:42',
      expect.any(String),
    );
  });

  it('does not turn a successful business operation into a failure when lock release is unavailable', async () => {
    const { service, redis } = createService(true);
    redis.releaseLockWithLua.mockRejectedValue(new Error('redis unavailable'));

    await expect((service as any).withRenewingRedisLock(
      'order:payment-cancel:42',
      90,
      'busy',
      async () => 'committed',
    )).resolves.toBe('committed');
  });

  it('still fails closed when the lease cannot be acquired', async () => {
    const { service } = createService(false);
    const action = jest.fn();

    await expect((service as any).withRenewingRedisLock(
      'order:payment-cancel:42',
      90,
      'busy',
      action,
    )).rejects.toBeInstanceOf(BadRequestException);

    expect(action).not.toHaveBeenCalled();
  });
});