import { BadRequestException } from '@nestjs/common';
import { PAYMENT_STATUS, REFUND_STATUS } from '../common/constants';
import { RecoverableProductionPaymentService } from './recoverable-production-payment.service';
import { StockSafeRecoverableProductionPaymentService } from './stock-safe-recoverable-production-payment.service';
import { CancellationSafeStockSafePaymentService } from './cancellation-safe-stock-safe-payment.service';

describe('CancellationSafeStockSafePaymentService', () => {
  afterEach(() => jest.restoreAllMocks());

  function createService(lockAcquired = true, refund?: any, terminalPayment?: any) {
    const prisma: any = {
      order: {
        findUnique: jest.fn().mockResolvedValue({ userId: 8n }),
      },
      orderPayment: {
        findFirst: jest.fn().mockResolvedValue(terminalPayment ?? null),
      },
      orderRefund: {
        findFirst: jest.fn().mockResolvedValue(refund ?? null),
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
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
    return { service, prisma, redis };
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

  it('serializes standard aftersale refund creation on the shared per-order lock', async () => {
    const baseCreateRefund = jest
      .spyOn(StockSafeRecoverableProductionPaymentService.prototype, 'createRefund')
      .mockResolvedValue({ refundId: '1', refundNo: 'R1', outRefundNo: 'R1' } as any);
    const { service, redis } = createService(true);
    const params = {
      orderId: '42',
      aftersaleId: '9',
      refundAmount: 500,
      reason: '同意退款',
    };

    const result = await service.createRefund(params);

    expect(redis.setNX).toHaveBeenCalledWith(
      'order:payment-cancel:42',
      expect.any(String),
      90,
    );
    expect(baseCreateRefund).toHaveBeenCalledTimes(1);
    expect(baseCreateRefund).toHaveBeenCalledWith(params);
    expect(redis.releaseLockWithLua).toHaveBeenCalled();
    expect(result).toEqual({ refundId: '1', refundNo: 'R1', outRefundNo: 'R1' });
  });

  it('does not enter the standard refund state machine when the order lock is occupied', async () => {
    const baseCreateRefund = jest.spyOn(
      StockSafeRecoverableProductionPaymentService.prototype,
      'createRefund',
    );
    const { service } = createService(false);

    await expect(service.createRefund({
      orderId: '42',
      aftersaleId: '9',
      refundAmount: 500,
      reason: '同意退款',
    })).rejects.toBeInstanceOf(BadRequestException);

    expect(baseCreateRefund).not.toHaveBeenCalled();
  });

  it('serializes refund-success core side effects per user across different orders', async () => {
    const baseProcessRefund = jest
      .spyOn(RecoverableProductionPaymentService.prototype, 'processWechatRefundSuccess')
      .mockResolvedValue(undefined);
    const { service, prisma, redis } = createService(true);
    const refund = { id: 11n, orderId: 42n, outRefundNo: 'R42' };
    const wechatData = { amount: { refund: 500, total: 1000 } };

    await service.processWechatRefundSuccess(refund, 'WX-R42', wechatData);

    expect(prisma.order.findUnique).toHaveBeenCalledWith({
      where: { id: 42n },
      select: { userId: true },
    });
    expect(redis.setNX).toHaveBeenCalledWith(
      'user:refund-success:8',
      expect.any(String),
      120,
    );
    expect(baseProcessRefund).toHaveBeenCalledWith(refund, 'WX-R42', wechatData);
    expect(redis.releaseLockWithLua).toHaveBeenCalled();
  });

  it('fails closed before refund-success point side effects when the user refund lock is occupied', async () => {
    const baseProcessRefund = jest.spyOn(
      RecoverableProductionPaymentService.prototype,
      'processWechatRefundSuccess',
    );
    const { service } = createService(false);

    await expect(service.processWechatRefundSuccess(
      { id: 11n, orderId: 42n, outRefundNo: 'R42' },
      'WX-R42',
      { amount: { refund: 500, total: 1000 } },
    )).rejects.toBeInstanceOf(BadRequestException);

    expect(baseProcessRefund).not.toHaveBeenCalled();
  });

  it('lets group-failure refund acquire the non-reentrant order lock exactly once through createRefund', async () => {
    const baseCreateRefund = jest
      .spyOn(StockSafeRecoverableProductionPaymentService.prototype, 'createRefund')
      .mockResolvedValue({ refundId: '1', refundNo: 'R1', outRefundNo: 'R1' } as any);
    const baseGroupRefund = jest
      .spyOn(RecoverableProductionPaymentService.prototype, 'createGroupBuyFailureRefund')
      .mockImplementation(async function (
        this: CancellationSafeStockSafePaymentService,
        orderId: bigint | string,
        reason = '拼团失败自动退款',
      ) {
        const result = await this.createRefund({
          orderId: String(orderId),
          refundAmount: 500,
          reason,
        });
        return { status: REFUND_STATUS.PENDING, ...result } as any;
      });
    const { service, redis } = createService(true);
    redis.setNX.mockReset().mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const result = await service.createGroupBuyFailureRefund('42', '拼团失败自动退款');

    expect(baseGroupRefund).toHaveBeenCalledWith('42', '拼团失败自动退款');
    expect(baseCreateRefund).toHaveBeenCalledTimes(1);
    expect(redis.setNX).toHaveBeenCalledTimes(1);
    expect(redis.setNX).toHaveBeenCalledWith(
      'order:payment-cancel:42',
      expect.any(String),
      90,
    );
    expect(result).toEqual(expect.objectContaining({
      status: REFUND_STATUS.PENDING,
      refundId: '1',
    }));
  });

  it('does not reopen a payment record that has already reached FAILED terminal state', async () => {
    const baseCreatePayment = jest.spyOn(
      StockSafeRecoverableProductionPaymentService.prototype,
      'createPayment',
    );
    const { service, prisma } = createService(true, undefined, {
      id: 7n,
      status: PAYMENT_STATUS.FAILED,
    });

    await expect(service.createPayment('42', '8')).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.orderPayment.findFirst).toHaveBeenCalledWith({
      where: { orderId: 42n, status: PAYMENT_STATUS.FAILED },
      select: { id: true },
    });
    expect(baseCreatePayment).not.toHaveBeenCalled();
  });

  it('reopens ABNORMAL to pending and runs the full refund-success chain when WeChat is SUCCESS', async () => {
    const refund = {
      id: 1n,
      orderId: 42n,
      status: REFUND_STATUS.ABNORMAL,
      refundAmount: 500,
      totalAmount: 1000,
      refundId: null,
      outRefundNo: 'OR1',
    };
    const { service, prisma } = createService(true, refund);
    jest.spyOn(service, 'queryRefund').mockResolvedValue({
      status: 'SUCCESS',
      refund_id: 'WX-R1',
      amount: { refund: 500, total: 1000 },
    });
    const processSuccess = jest
      .spyOn(service, 'processWechatRefundSuccess')
      .mockResolvedValue(undefined);

    const result = await service.syncRefund('OR1');

    expect(prisma.orderRefund.updateMany).toHaveBeenCalledWith({
      where: { id: 1n, status: REFUND_STATUS.ABNORMAL },
      data: expect.objectContaining({
        status: REFUND_STATUS.PENDING,
        refundId: 'WX-R1',
      }),
    });
    expect(processSuccess).toHaveBeenCalledWith(
      refund,
      'WX-R1',
      expect.objectContaining({ status: 'SUCCESS' }),
    );
    expect(result).toEqual(expect.objectContaining({
      synced: true,
      reason: 'abnormal_recovered_success',
      status: REFUND_STATUS.SUCCESS,
      recoveredFrom: REFUND_STATUS.ABNORMAL,
    }));
  });

  it('moves ABNORMAL to CLOSED without running refund-success effects when WeChat is CLOSED', async () => {
    const refund = {
      id: 2n,
      status: REFUND_STATUS.ABNORMAL,
      refundAmount: 500,
      totalAmount: 1000,
      refundId: null,
      outRefundNo: 'OR2',
    };
    const { service, prisma } = createService(true, refund);
    jest.spyOn(service, 'queryRefund').mockResolvedValue({
      status: 'CLOSED',
      refund_id: 'WX-R2',
    });
    const processSuccess = jest.spyOn(service, 'processWechatRefundSuccess');

    const result = await service.syncRefund('OR2');

    expect(prisma.orderRefund.updateMany).toHaveBeenCalledWith({
      where: { id: 2n, status: REFUND_STATUS.ABNORMAL },
      data: expect.objectContaining({
        status: REFUND_STATUS.CLOSED,
        refundId: 'WX-R2',
      }),
    });
    expect(processSuccess).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({
      synced: true,
      reason: 'abnormal_recovered_closed',
      status: REFUND_STATUS.CLOSED,
    }));
  });

  it('keeps ABNORMAL frozen and only refreshes its observation when WeChat is still ABNORMAL', async () => {
    const refund = {
      id: 3n,
      status: REFUND_STATUS.ABNORMAL,
      refundAmount: 500,
      totalAmount: 1000,
      refundId: 'WX-R3',
      outRefundNo: 'OR3',
    };
    const { service, prisma } = createService(true, refund);
    jest.spyOn(service, 'queryRefund').mockResolvedValue({
      status: 'ABNORMAL',
      refund_id: 'WX-R3',
    });
    const processSuccess = jest.spyOn(service, 'processWechatRefundSuccess');

    const result = await service.syncRefund('OR3');

    expect(prisma.orderRefund.updateMany).toHaveBeenCalledWith({
      where: { id: 3n, status: REFUND_STATUS.ABNORMAL },
      data: expect.objectContaining({
        refundId: 'WX-R3',
        rawResponse: expect.objectContaining({ status: 'ABNORMAL' }),
      }),
    });
    expect(processSuccess).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({
      synced: false,
      reason: 'wechat_still_abnormal',
      status: REFUND_STATUS.ABNORMAL,
    }));
  });
});
