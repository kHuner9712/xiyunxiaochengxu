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
    jest.restoreAllMocks();
  });

  it('renews a long-running lease before its TTL expires', async () => {
    const { service, redis } = createService(true);
    let heartbeat: (() => void) | undefined;
    const timer = { unref: jest.fn() } as any;
    jest.spyOn(global, 'setInterval').mockImplementation(((callback: (...args: any[]) => void) => {
      heartbeat = () => callback();
      return timer;
    }) as any);
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval').mockImplementation((() => undefined) as any);
    let resolveAction!: (value: string) => void;

    const pending = (service as any).withRenewingRedisLock(
      'order:payment-cancel:42',
      3,
      'busy',
      () => new Promise<string>((resolve) => {
        resolveAction = resolve;
      }),
    );

    // Cross one event-loop turn so the awaited Redis SET NX continuation installs the heartbeat.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(heartbeat).toBeDefined();

    heartbeat!();
    await Promise.resolve();

    expect(redis.extendLockWithLua).toHaveBeenCalledWith(
      'order:payment-cancel:42',
      expect.any(String),
      3,
    );
    expect(timer.unref).toHaveBeenCalled();

    resolveAction('done');
    await expect(pending).resolves.toBe('done');
    expect(clearIntervalSpy).toHaveBeenCalledWith(timer);
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