import { BadRequestException } from '@nestjs/common';
import { REFUND_STATUS } from '../common/constants';
import { ProductionPaymentService } from './production-payment.service';
import { RecoverableProductionPaymentService } from './recoverable-production-payment.service';

describe('RecoverableProductionPaymentService ordinary refund recovery', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  function createService(latestFailed: any) {
    const service = Object.create(
      RecoverableProductionPaymentService.prototype,
    ) as RecoverableProductionPaymentService;
    (service as any).recoveryPrisma = {
      orderRefund: {
        findFirst: jest.fn().mockResolvedValue(latestFailed),
      },
    };
    return service;
  }

  const params = {
    orderId: '42',
    aftersaleId: '7',
    refundAmount: 1000,
    reason: '售后退款',
  };

  it('reuses the previous refund when WeChat proves the locally failed attempt is already processing', async () => {
    const latestFailed = {
      id: 11n,
      orderId: 42n,
      aftersaleId: 7n,
      status: REFUND_STATUS.FAILED,
      refundNo: 'R11',
      outRefundNo: 'OR11',
    };
    const service = createService(latestFailed);
    jest.spyOn(service as any, 'resolveUncertainFailedRefund').mockResolvedValue({
      retryable: false,
      status: REFUND_STATUS.PENDING,
    });
    const baseCreate = jest
      .spyOn(ProductionPaymentService.prototype, 'createRefund')
      .mockRejectedValue(new Error('must not create a second refund'));

    await expect(service.createRefund(params)).resolves.toEqual({
      refundId: '11',
      refundNo: 'R11',
      outRefundNo: 'OR11',
      status: REFUND_STATUS.PENDING,
      recovered: true,
    });
    expect(baseCreate).not.toHaveBeenCalled();
  });

  it('allows a new refund only after the previous failed attempt is definitively retryable', async () => {
    const latestFailed = {
      id: 12n,
      orderId: 42n,
      aftersaleId: 7n,
      status: REFUND_STATUS.FAILED,
      refundNo: 'R12',
      outRefundNo: 'OR12',
    };
    const service = createService(latestFailed);
    jest.spyOn(service as any, 'resolveUncertainFailedRefund').mockResolvedValue({
      retryable: true,
      status: REFUND_STATUS.CLOSED,
    });
    const expected = {
      refundId: '13',
      refundNo: 'R13',
      outRefundNo: 'OR13',
      status: REFUND_STATUS.PENDING,
    };
    const baseCreate = jest
      .spyOn(ProductionPaymentService.prototype, 'createRefund')
      .mockResolvedValue(expected as any);

    await expect(service.createRefund(params)).resolves.toEqual(expected);
    expect(baseCreate).toHaveBeenCalledTimes(1);
    expect(baseCreate).toHaveBeenCalledWith(params);
  });

  it('blocks a duplicate refund when the previous attempt remains abnormal or unconfirmed', async () => {
    const latestFailed = {
      id: 14n,
      orderId: 42n,
      aftersaleId: 7n,
      status: REFUND_STATUS.FAILED,
      refundNo: 'R14',
      outRefundNo: 'OR14',
    };
    const service = createService(latestFailed);
    jest.spyOn(service as any, 'resolveUncertainFailedRefund').mockResolvedValue({
      retryable: false,
      status: REFUND_STATUS.ABNORMAL,
    });
    const baseCreate = jest
      .spyOn(ProductionPaymentService.prototype, 'createRefund')
      .mockRejectedValue(new Error('must not create a second refund'));

    await expect(service.createRefund(params)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(baseCreate).not.toHaveBeenCalled();
  });
});
