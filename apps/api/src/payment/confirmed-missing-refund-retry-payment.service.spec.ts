import { jest } from '@jest/globals';
import { PAYMENT_STATUS, REFUND_STATUS, WECHAT_REFUND_STATUS } from '../common/constants';
import { ConfirmedMissingRefundRetryPaymentService } from './confirmed-missing-refund-retry-payment.service';
import { OrphanSafeMemberGrowthPaymentService } from './orphan-safe-member-growth-payment.service';

function createService(
  localStatus: string,
  paymentSnapshot?: { id: bigint; orderId: bigint; amount: number; status: number } | null,
  orderSnapshot?: { id: bigint; orderNo: string; payAmount: number | null } | null,
) {
  const prisma: any = {
    orderRefund: {
      findFirst: jest.fn(async () => ({ status: localStatus })),
    },
    orderPayment: {
      findUnique: jest.fn(async () => paymentSnapshot ?? null),
    },
    order: {
      findUnique: jest.fn(async () => orderSnapshot ?? null),
    },
  };
  const config: any = { get: jest.fn((_key: string, fallback?: unknown) => fallback ?? '') };
  const businessEvent: any = { emitCritical: jest.fn() };
  const orderService: any = {};
  const shareService: any = {};
  const benefitPackageService: any = {};
  const merchantSettlementService: any = {};
  const groupBuyService: any = {};
  const flashSaleService: any = {};
  const redisService: any = {};

  const service = new ConfirmedMissingRefundRetryPaymentService(
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
  return { service, prisma, businessEvent };
}

describe('ConfirmedMissingRefundRetryPaymentService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects a remote SUCCESS amount that differs from the authoritative local amount', async () => {
    const { service, businessEvent } = createService(
      REFUND_STATUS.FAILED,
      { id: 10n, orderId: 20n, amount: 9900, status: PAYMENT_STATUS.CREATED },
      { id: 20n, orderNo: 'ORD-AMOUNT-1', payAmount: 9900 },
    );
    const downstream = jest
      .spyOn(OrphanSafeMemberGrowthPaymentService.prototype as any, 'processPaymentSuccess')
      .mockResolvedValue(undefined);

    await expect(
      service.processPaymentSuccess(10n, 20n, 'wx-txn-1', 1, { payAmount: 9900 }),
    ).rejects.toThrow('支付金额不匹配');
    expect(downstream).not.toHaveBeenCalled();
    expect(businessEvent.emitCritical).toHaveBeenCalledWith(
      'payment_success_amount_invariant_violation',
      'payment',
      expect.any(String),
      'ORD-AMOUNT-1',
      expect.objectContaining({
        paymentAmount: 9900,
        orderAmount: 9900,
        remoteAmount: 1,
        reason: 'remote_amount_mismatch',
      }),
    );
  });

  it('rejects a missing remote SUCCESS amount while the local payment is not already SUCCESS', async () => {
    const { service } = createService(
      REFUND_STATUS.FAILED,
      { id: 11n, orderId: 21n, amount: 5000, status: PAYMENT_STATUS.CREATED },
      { id: 21n, orderNo: 'ORD-AMOUNT-2', payAmount: 5000 },
    );
    const downstream = jest
      .spyOn(OrphanSafeMemberGrowthPaymentService.prototype as any, 'processPaymentSuccess')
      .mockResolvedValue(undefined);

    await expect(
      service.processPaymentSuccess(11n, 21n, 'wx-txn-2', null, { payAmount: 5000 }),
    ).rejects.toThrow('支付成功金额缺失');
    expect(downstream).not.toHaveBeenCalled();
  });

  it('allows amount-less half-success repair only when the local payment fact is already SUCCESS', async () => {
    const { service } = createService(
      REFUND_STATUS.FAILED,
      { id: 12n, orderId: 22n, amount: 8800, status: PAYMENT_STATUS.SUCCESS },
      { id: 22n, orderNo: 'ORD-AMOUNT-3', payAmount: 8800 },
    );
    const downstream = jest
      .spyOn(OrphanSafeMemberGrowthPaymentService.prototype as any, 'processPaymentSuccess')
      .mockResolvedValue(undefined);

    await expect(
      service.processPaymentSuccess(12n, 22n, 'wx-txn-3', null, { payAmount: 8800 }),
    ).resolves.toBeUndefined();
    expect(downstream).toHaveBeenCalledWith(
      12n,
      22n,
      'wx-txn-3',
      null,
      { payAmount: 8800 },
    );
  });

  it('rejects a broken local payment/order amount invariant before processing remote success', async () => {
    const { service } = createService(
      REFUND_STATUS.FAILED,
      { id: 13n, orderId: 23n, amount: 8800, status: PAYMENT_STATUS.CREATED },
      { id: 23n, orderNo: 'ORD-AMOUNT-4', payAmount: 9900 },
    );
    const downstream = jest
      .spyOn(OrphanSafeMemberGrowthPaymentService.prototype as any, 'processPaymentSuccess')
      .mockResolvedValue(undefined);

    await expect(
      service.processPaymentSuccess(13n, 23n, 'wx-txn-4', 8800, { payAmount: 9900 }),
    ).rejects.toThrow('本地支付金额状态异常');
    expect(downstream).not.toHaveBeenCalled();
  });

  it('translates WeChat RESOURCE_NOT_EXISTS to CLOSED only for a local FAILED refund', async () => {
    const error = Object.assign(new Error('refund not found'), {
      response: { data: { code: 'RESOURCE_NOT_EXISTS' } },
    });
    jest
      .spyOn(OrphanSafeMemberGrowthPaymentService.prototype, 'queryRefund')
      .mockRejectedValue(error as never);
    const { service, prisma } = createService(REFUND_STATUS.FAILED);

    await expect(service.queryRefund('RF-404')).resolves.toEqual({
      status: WECHAT_REFUND_STATUS.CLOSED,
      syntheticTerminalReason: 'RESOURCE_NOT_EXISTS',
    });
    expect(prisma.orderRefund.findFirst).toHaveBeenCalledWith({
      where: { outRefundNo: 'RF-404' },
      select: { status: true },
    });
  });

  it('keeps RESOURCE_NOT_EXISTS as an error for a local PENDING refund', async () => {
    const error = Object.assign(new Error('refund not found'), {
      response: { data: { code: 'RESOURCE_NOT_EXISTS' } },
    });
    jest
      .spyOn(OrphanSafeMemberGrowthPaymentService.prototype, 'queryRefund')
      .mockRejectedValue(error as never);
    const { service } = createService(REFUND_STATUS.PENDING);

    await expect(service.queryRefund('RF-PENDING')).rejects.toBe(error);
  });

  it('does not reinterpret unrelated WeChat query failures', async () => {
    const error = Object.assign(new Error('system error'), {
      response: { data: { code: 'SYSTEM_ERROR' } },
    });
    jest
      .spyOn(OrphanSafeMemberGrowthPaymentService.prototype, 'queryRefund')
      .mockRejectedValue(error as never);
    const { service, prisma } = createService(REFUND_STATUS.FAILED);

    await expect(service.queryRefund('RF-SYSTEM')).rejects.toBe(error);
    expect(prisma.orderRefund.findFirst).not.toHaveBeenCalled();
  });
});
