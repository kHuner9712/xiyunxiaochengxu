import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';

function createMockPaymentService() {
  return {
    handleCallback: jest.fn(),
    handleRefundCallback: jest.fn(),
    createPayment: jest.fn(),
    getPaymentStatus: jest.fn(),
  };
}

function createController(mockService?: any) {
  const service = mockService || createMockPaymentService();
  const controller = new PaymentController(service as any);
  jest.spyOn(controller['logger'], 'error').mockImplementation(() => {});
  return { controller, mockService: service };
}

describe('PaymentController callback 异常兜底', () => {
  let controller: PaymentController;
  let mockService: any;

  beforeEach(() => {
    ({ controller, mockService } = createController());
  });

  it('handleCallback 正常返回微信格式', async () => {
    mockService.handleCallback.mockResolvedValue({ code: 'SUCCESS', message: '成功' });
    const result = await controller.callback({}, {}, { rawBody: Buffer.from('') });
    expect(result).toEqual({ code: 'SUCCESS', message: '成功' });
  });

  it('handleCallback 抛异常时返回 { code: FAIL }，不被全局 Filter 包装', async () => {
    mockService.handleCallback.mockRejectedValue(new Error('数据库连接超时'));
    const result = await controller.callback({}, {}, { rawBody: Buffer.from('') });
    expect(result).toEqual({ code: 'FAIL', message: '数据库连接超时' });
    expect(result).not.toHaveProperty('data');
    expect(result).not.toHaveProperty('statusCode');
  });

  it('handleCallback 抛 HttpException 时仍返回微信格式', async () => {
    const { BadRequestException } = await import('@nestjs/common');
    mockService.handleCallback.mockRejectedValue(new BadRequestException('签名验证失败'));
    const result = await controller.callback({}, {}, { rawBody: Buffer.from('') });
    expect(result).toEqual({ code: 'FAIL', message: '签名验证失败' });
  });

  it('handleCallback 抛无 message 异常时使用默认文案', async () => {
    mockService.handleCallback.mockRejectedValue({ stack: 'xxx' });
    const result = await controller.callback({}, {}, { rawBody: Buffer.from('') });
    expect(result).toEqual({ code: 'FAIL', message: '支付回调处理失败' });
  });
});

describe('PaymentController refundCallback 异常兜底', () => {
  let controller: PaymentController;
  let mockService: any;

  beforeEach(() => {
    ({ controller, mockService } = createController());
  });

  it('handleRefundCallback 正常返回微信格式', async () => {
    mockService.handleRefundCallback.mockResolvedValue({ code: 'SUCCESS', message: '成功' });
    const result = await controller.refundCallback({}, {}, { rawBody: Buffer.from('') });
    expect(result).toEqual({ code: 'SUCCESS', message: '成功' });
  });

  it('handleRefundCallback 抛异常时返回 { code: FAIL }，不被全局 Filter 包装', async () => {
    mockService.handleRefundCallback.mockRejectedValue(new Error('退款状态更新失败'));
    const result = await controller.refundCallback({}, {}, { rawBody: Buffer.from('') });
    expect(result).toEqual({ code: 'FAIL', message: '退款状态更新失败' });
    expect(result).not.toHaveProperty('data');
    expect(result).not.toHaveProperty('statusCode');
  });

  it('handleRefundCallback 抛 HttpException 时仍返回微信格式', async () => {
    const { BadRequestException } = await import('@nestjs/common');
    mockService.handleRefundCallback.mockRejectedValue(new BadRequestException('退款单不存在'));
    const result = await controller.refundCallback({}, {}, { rawBody: Buffer.from('') });
    expect(result).toEqual({ code: 'FAIL', message: '退款单不存在' });
  });

  it('handleRefundCallback 抛无 message 异常时使用默认文案', async () => {
    mockService.handleRefundCallback.mockRejectedValue({ stack: 'xxx' });
    const result = await controller.refundCallback({}, {}, { rawBody: Buffer.from('') });
    expect(result).toEqual({ code: 'FAIL', message: '退款回调处理失败' });
  });
});
