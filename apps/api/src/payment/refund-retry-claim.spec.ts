import { describe, expect, it, jest } from '@jest/globals';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { REFUND_STATUS } from '../common/constants';
import { PaymentService } from './payment.service';

function createService(prismaOverrides: any = {}) {
  const prisma = {
    orderRefund: {
      findFirst: jest.fn(),
      ...prismaOverrides.orderRefund,
    },
    refundCallbackLog: {
      updateMany: jest.fn(),
      ...prismaOverrides.refundCallbackLog,
    },
    ...prismaOverrides,
  } as any;

  const configService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      if (key === 'NODE_ENV') return 'test';
      return defaultValue;
    }),
  } as any;

  const businessEvent = {
    emitCritical: jest.fn(),
    emitError: jest.fn(),
    emitWarn: jest.fn(),
    emitInfo: jest.fn(),
  } as any;

  const service = new PaymentService(
    prisma,
    configService,
    businessEvent,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );

  jest.spyOn(service['logger'], 'log').mockImplementation(() => {});
  jest.spyOn(service['logger'], 'warn').mockImplementation(() => {});
  jest.spyOn(service['logger'], 'error').mockImplementation(() => {});

  return { service, prisma, businessEvent };
}

describe('refund retry claim safety', () => {
  it('processWechatRefundSuccess refuses a refund currently used as a retry claim', async () => {
    const tx = {
      orderRefund: {
        updateMany: jest.fn(async () => ({ count: 0 })),
        findUnique: jest.fn(async () => ({ id: 70n, status: REFUND_STATUS.RETRYING })),
      },
    };
    const { service } = createService({
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    });

    const refund = {
      id: 70n,
      outRefundNo: 'RF70',
      refundAmount: 9900,
      aftersaleId: null,
    };

    await expect(
      service.processWechatRefundSuccess(refund, 'WX-REFUND-70', {
        status: 'SUCCESS',
        amount: { refund: 9900, total: 9900 },
      }),
    ).rejects.toThrow(`退款状态异常: ${REFUND_STATUS.RETRYING}`);

    expect(tx.orderRefund.updateMany).toHaveBeenCalledWith({
      where: {
        id: 70n,
        status: {
          in: [
            REFUND_STATUS.INITIATING,
            REFUND_STATUS.PENDING,
            REFUND_STATUS.PROCESSING,
            REFUND_STATUS.FAILED,
          ],
        },
      },
      data: expect.objectContaining({ status: REFUND_STATUS.PROCESSING }),
    });
  });

  it('syncRefund does not auto-apply SUCCESS side effects while retry claim is active', async () => {
    const refund = {
      id: 70n,
      outRefundNo: 'RF70',
      refundAmount: 9900,
      totalAmount: 9900,
      refundId: null,
      aftersaleId: 50n,
      status: REFUND_STATUS.RETRYING,
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
  it('requires a decimal order id before service bigint conversion', () => {
    const controller = readFileSync(resolve(__dirname, 'payment.controller.ts'), 'utf8');

    expect(controller).toMatch(/IsIn, Matches/);
    expect(controller).toMatch(/@Matches\(\/\^\\d\+\$\/, \{ message: '订单ID必须为数字' \}\)/);
  });
});
