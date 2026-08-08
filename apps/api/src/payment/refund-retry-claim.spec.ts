import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { REFUND_STATUS } from '../common/constants';
import { PaymentService } from './payment.service';

function createService(overrides: Record<string, any> = {}) {
  const prisma: any = {
    orderRefund: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      aggregate: jest.fn(),
      ...overrides.orderRefund,
    },
    order: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      ...overrides.order,
    },
    orderPayment: { findFirst: jest.fn(), update: jest.fn(), ...overrides.orderPayment },
    paymentCompensationTask: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      ...overrides.paymentCompensationTask,
    },
    $transaction: jest.fn(async (callback: any) => callback(prisma)),
    $queryRaw: jest.fn(),
    ...overrides.prisma,
  };
  const config: any = { get: jest.fn() };
  const businessEvent: any = { emit: jest.fn() };
  const orderService: any = {};
  const shareService: any = {};
  const benefitPackageService: any = {
    assertRefundable: jest.fn(),
    freezeForRefund: jest.fn(),
    revokeAfterRefundSuccess: jest.fn(),
    restoreAfterRefundFailure: jest.fn(),
  };
  const merchantSettlementService: any = { reverseSalesCommissionAfterRefund: jest.fn() };
  const groupBuyService: any = { handleRefundSuccess: jest.fn() };
  const flashSaleService: any = {};
  const service = new PaymentService(
    prisma,
    config,
    businessEvent,
    orderService,
    shareService,
    benefitPackageService,
    merchantSettlementService,
    groupBuyService,
    flashSaleService,
  );
  jest.spyOn((service as any).logger, 'log').mockImplementation(() => undefined);
  jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);
  jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);
  return { service, prisma };
}

describe('refund retry claim', () => {
  it('does not resubmit an uncertain failed refund before querying WeChat', async () => {
    const refund: any = {
      id: 7n,
      orderId: 70n,
      aftersaleId: 700n,
      outRefundNo: 'RF70',
      refundAmount: 9900,
      reason: '售后退款',
      status: REFUND_STATUS.FAILED,
      wechatRefundId: null,
      updatedAt: new Date(),
    };
    const { service } = createService({
      orderRefund: {
        findFirst: jest.fn(async () => refund),
      },
    });
    const querySpy = jest.spyOn(service, 'queryRefund').mockResolvedValue({
      status: 'PROCESSING',
      refund_id: 'WX-REFUND-70',
      amount: { refund: 9900, total: 9900 },
    });
    const createRefundSpy = jest.spyOn(service, 'createRefund');

    const result = await service.syncRefund('RF70');

    expect(querySpy).toHaveBeenCalledWith('RF70');
    expect(createRefundSpy).not.toHaveBeenCalled();
    expect(result).toEqual({ synced: false, reason: 'processing' });
  });

  it('processes confirmed WeChat success for a failed local refund', async () => {
    const refund: any = {
      id: 7n,
      orderId: 70n,
      aftersaleId: 700n,
      outRefundNo: 'RF70',
      refundAmount: 9900,
      reason: '售后退款',
      status: REFUND_STATUS.FAILED,
      wechatRefundId: null,
      updatedAt: new Date(),
    };
    const { service, prisma } = createService({
      orderRefund: {
        findFirst: jest.fn(async () => refund),
      },
    });
    jest.spyOn(service, 'queryRefund').mockResolvedValue({
      status: 'SUCCESS',
      refund_id: 'WX-REFUND-70',
      amount: { refund: 9900, total: 9900 },
    });
    const processSpy = jest.spyOn(service, 'processWechatRefundSuccess').mockResolvedValue(undefined as any);

    await expect(service.syncRefund('RF70')).resolves.toEqual({ synced: true, status: 'success' });

    expect(prisma.orderRefund.findFirst).toHaveBeenCalledWith({ where: { outRefundNo: 'RF70' } });
    expect(processSpy).toHaveBeenCalledWith(refund, 'WX-REFUND-70', expect.any(Object));
  });

  it('refuses to auto-compensate unexpected local statuses', async () => {
    const refund: any = {
      id: 7n,
      orderId: 70n,
      aftersaleId: 700n,
      outRefundNo: 'RF70',
      refundAmount: 9900,
      reason: '售后退款',
      status: REFUND_STATUS.RETRYING,
      wechatRefundId: null,
      updatedAt: new Date(),
    };
    const { service, prisma } = createService({
      orderRefund: {
        findFirst: jest.fn(async () => refund),
      },
    });
    jest.spyOn(service, 'queryRefund').mockResolvedValue({
      status: 'SUCCESS',
      refund_id: 'WX-REFUND-70',
      amount: { refund: 9900, total: 9900 },
    });
    const processSpy = jest.spyOn(service, 'processWechatRefundSuccess');

    await expect(service.syncRefund('RF70')).resolves.toEqual({
      synced: false,
      reason: 'unexpected_local_status',
      message: `本地退款状态异常(${REFUND_STATUS.RETRYING})，无法自动补偿`,
    });

    expect(prisma.orderRefund.findFirst).toHaveBeenCalledWith({ where: { outRefundNo: 'RF70' } });
    expect(processSpy).not.toHaveBeenCalled();
  });
});

describe('refund query validation', () => {
  it('requires a positive decimal order id before service bigint conversion', () => {
    const controller = readFileSync(resolve(__dirname, 'payment.controller.ts'), 'utf8');

    expect(controller).toMatch(/const POSITIVE_ID = \/\^\[1-9\]\\d\*\$\//);
    expect(controller).toMatch(/@Matches\(POSITIVE_ID, \{ message: '订单ID格式无效' \}\) orderId\?: string/);
  });
});
