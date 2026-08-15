import { BadRequestException } from '@nestjs/common';
import {
  PaymentCompensationController,
  PaymentController,
  RefundController,
} from './payment.controller';

function paymentServiceMock() {
  return {
    getPaymentStatus: jest.fn(),
    getRefundDetail: jest.fn(),
    syncRefund: jest.fn(),
    resolveCompensationTask: jest.fn(),
  };
}

describe('payment route identifier boundaries', () => {
  it('rejects invalid order ids before querying payment status', async () => {
    const service = paymentServiceMock();
    const controller = new PaymentController(service as any);

    await expect(controller.queryStatus('9', '0')).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.queryStatus('9', 'not-an-id')).rejects.toBeInstanceOf(BadRequestException);
    expect(service.getPaymentStatus).not.toHaveBeenCalled();

    service.getPaymentStatus.mockResolvedValue({ displayStatus: 'pending' });
    await controller.queryStatus('9', '123');
    expect(service.getPaymentStatus).toHaveBeenCalledWith('123', '9');
  });

  it('rejects invalid refund record ids before service access', async () => {
    const service = paymentServiceMock();
    const controller = new RefundController(service as any);

    await expect(controller.getDetail('0')).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.getDetail('abc')).rejects.toBeInstanceOf(BadRequestException);
    expect(service.getRefundDetail).not.toHaveBeenCalled();

    service.getRefundDetail.mockResolvedValue({ id: '17' });
    await controller.getDetail('17');
    expect(service.getRefundDetail).toHaveBeenCalledWith('17');
  });

  it('only syncs internally generated refund number shapes', async () => {
    const service = paymentServiceMock();
    const controller = new RefundController(service as any);

    await expect(controller.syncRefund('REFUND-bad')).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.syncRefund('REFUND20260815093000abcdef-extra')).rejects.toBeInstanceOf(BadRequestException);
    expect(service.syncRefund).not.toHaveBeenCalled();

    service.syncRefund.mockResolvedValue({ status: 'success' });
    await controller.syncRefund('REFUND20260815093000abcdef');
    expect(service.syncRefund).toHaveBeenCalledWith('REFUND20260815093000abcdef');
  });

  it('rejects invalid compensation task ids before the hardened service can BigInt-convert them', async () => {
    const service = paymentServiceMock();
    const controller = new PaymentCompensationController(service as any);

    await expect(controller.resolveCompensationTask('bad', '8', {
      resolution: '已核对',
      status: 'resolved',
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(service.resolveCompensationTask).not.toHaveBeenCalled();

    service.resolveCompensationTask.mockResolvedValue({ id: '5', status: 'resolved' });
    await controller.resolveCompensationTask('5', '8', {
      resolution: '已核对',
      status: 'resolved',
    });
    expect(service.resolveCompensationTask).toHaveBeenCalledWith('5', '8', '已核对', 'resolved');
  });
});
