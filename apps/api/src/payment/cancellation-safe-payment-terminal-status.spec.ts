import { PAYMENT_STATUS } from '../common/constants';
import { CancellationSafeStockSafePaymentService } from './cancellation-safe-stock-safe-payment.service';
import { StockSafeRecoverableProductionPaymentService } from './stock-safe-recoverable-production-payment.service';

describe('CancellationSafeStockSafePaymentService terminal payment convergence', () => {
  afterEach(() => jest.restoreAllMocks());

  function createService(options: {
    updateCount?: number;
    currentPaymentStatus?: number;
    lockAcquired?: boolean;
  } = {}) {
    const prisma: any = {
      orderPayment: {
        updateMany: jest.fn().mockResolvedValue({ count: options.updateCount ?? 1 }),
        findFirst: jest.fn().mockResolvedValue(
          options.currentPaymentStatus === undefined
            ? null
            : { status: options.currentPaymentStatus },
        ),
      },
    };
    const config: any = {
      get: jest.fn((key: string, fallback?: unknown) => {
        if (key === 'NODE_ENV') return 'test';
        return fallback;
      }),
    };
    const redis: any = {
      setNX: jest.fn().mockResolvedValue(options.lockAcquired ?? true),
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
    return { service, prisma, redis };
  }

  function paymentResult(overrides: Record<string, unknown> = {}) {
    return {
      orderId: '42',
      orderNo: 'XY202608150001',
      orderStatus: 'pending_payment',
      paymentStatus: PAYMENT_STATUS.CREATED,
      paymentMethod: 'wechat',
      amount: 100,
      paidAt: null,
      transactionId: null,
      confirming: false,
      tradeState: 'CLOSED',
      displayStatus: 'closed',
      canRetryPay: true,
      ...overrides,
    } as any;
  }

  it('persists authoritative CLOSED as FAILED and disables retrying the same WeChat order', async () => {
    const baseGetStatus = jest
      .spyOn(StockSafeRecoverableProductionPaymentService.prototype, 'getPaymentStatus')
      .mockResolvedValue(paymentResult());
    const { service, prisma, redis } = createService();

    const result = await service.getPaymentStatus('42', '8');

    expect(baseGetStatus).toHaveBeenCalledWith('42', '8');
    expect(prisma.orderPayment.updateMany).toHaveBeenCalledWith({
      where: { orderId: 42n, status: PAYMENT_STATUS.CREATED },
      data: { status: PAYMENT_STATUS.FAILED },
    });
    expect(result.paymentStatus).toBe(PAYMENT_STATUS.FAILED);
    expect(result.displayStatus).toBe('closed');
    expect(result.confirming).toBe(false);
    expect(result.canRetryPay).toBe(false);
    expect(result.message).toContain('取消订单后重新下单');
    expect(redis.setNX).toHaveBeenCalledWith(
      'order:payment-cancel:42',
      expect.any(String),
      90,
    );
    expect(redis.releaseLockWithLua).toHaveBeenCalled();
  });

  it('keeps NOTPAY retryable and does not write a false FAILED terminal state', async () => {
    jest
      .spyOn(StockSafeRecoverableProductionPaymentService.prototype, 'getPaymentStatus')
      .mockResolvedValue(paymentResult({
        tradeState: 'NOTPAY',
        displayStatus: 'pending',
        confirming: true,
        canRetryPay: true,
      }));
    const { service, prisma } = createService();

    const result = await service.getPaymentStatus('42', '8');

    expect(prisma.orderPayment.updateMany).not.toHaveBeenCalled();
    expect(result.paymentStatus).toBe(PAYMENT_STATUS.CREATED);
    expect(result.canRetryPay).toBe(true);
  });

  it('prefers a concurrent local SUCCESS when the terminal FAILED compare-and-set loses the race', async () => {
    const success = paymentResult({
      orderStatus: 'pending_delivery',
      paymentStatus: PAYMENT_STATUS.SUCCESS,
      tradeState: undefined,
      displayStatus: 'success',
      canRetryPay: false,
    });
    const baseGetStatus = jest
      .spyOn(StockSafeRecoverableProductionPaymentService.prototype, 'getPaymentStatus')
      .mockResolvedValueOnce(paymentResult())
      .mockResolvedValueOnce(success);
    const { service, prisma } = createService({
      updateCount: 0,
      currentPaymentStatus: PAYMENT_STATUS.SUCCESS,
    });

    const result = await service.getPaymentStatus('42', '8');

    expect(prisma.orderPayment.findFirst).toHaveBeenCalledWith({
      where: { orderId: 42n },
      orderBy: { createdAt: 'desc' },
      select: { status: true },
    });
    expect(baseGetStatus).toHaveBeenCalledTimes(2);
    expect(result.paymentStatus).toBe(PAYMENT_STATUS.SUCCESS);
    expect(result.displayStatus).toBe('success');
    expect(result.canRetryPay).toBe(false);
  });
});
