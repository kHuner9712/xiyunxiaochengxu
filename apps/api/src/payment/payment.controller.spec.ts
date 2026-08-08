import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { PaymentController } from './payment.controller';

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

function callbackBody() {
  return {
    id: 'evt-1',
    create_time: '2026-08-08T12:00:00+08:00',
    resource_type: 'encrypt-resource',
    event_type: 'TRANSACTION.SUCCESS',
    summary: '支付成功',
    resource: {
      original_type: 'transaction',
      algorithm: 'AEAD_AES_256_GCM',
      ciphertext: 'ciphertext',
      associated_data: 'transaction',
      nonce: 'nonce',
    },
  };
}

describe('PaymentController callback 异常兜底', () => {
  let controller: PaymentController;
  let mockService: any;

  beforeEach(() => {
    ({ controller, mockService } = createController());
  });

  it('handleCallback 正常返回微信格式', async () => {
    mockService.handleCallback.mockResolvedValue({ code: 'SUCCESS', message: '成功' });
    const body = callbackBody();
    const result = await controller.callback(body, {}, { rawBody: Buffer.from('') });
    expect(result).toEqual({ code: 'SUCCESS', message: '成功' });
    expect(mockService.handleCallback).toHaveBeenCalledWith(body, {}, Buffer.from(''));
  });

  it('handleCallback 抛异常时返回 { code: FAIL }，不被全局 Filter 包装', async () => {
    mockService.handleCallback.mockRejectedValue(new Error('数据库连接超时'));
    const result = await controller.callback(callbackBody(), {}, { rawBody: Buffer.from('') });
    expect(result).toEqual({ code: 'FAIL', message: '数据库连接超时' });
    expect(result).not.toHaveProperty('data');
    expect(result).not.toHaveProperty('statusCode');
  });

  it('handleCallback 抛 HttpException 时仍返回微信格式', async () => {
    const { BadRequestException } = await import('@nestjs/common');
    mockService.handleCallback.mockRejectedValue(new BadRequestException('签名验证失败'));
    const result = await controller.callback(callbackBody(), {}, { rawBody: Buffer.from('') });
    expect(result).toEqual({ code: 'FAIL', message: '签名验证失败' });
  });

  it('handleCallback 抛无 message 异常时使用默认文案', async () => {
    mockService.handleCallback.mockRejectedValue({ stack: 'xxx' });
    const result = await controller.callback(callbackBody(), {}, { rawBody: Buffer.from('') });
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
    const body = { ...callbackBody(), event_type: 'REFUND.SUCCESS' };
    const result = await controller.refundCallback(body, {}, { rawBody: Buffer.from('') });
    expect(result).toEqual({ code: 'SUCCESS', message: '成功' });
  });

  it('handleRefundCallback 抛异常时返回 { code: FAIL }，不被全局 Filter 包装', async () => {
    mockService.handleRefundCallback.mockRejectedValue(new Error('退款状态更新失败'));
    const result = await controller.refundCallback(callbackBody(), {}, { rawBody: Buffer.from('') });
    expect(result).toEqual({ code: 'FAIL', message: '退款状态更新失败' });
    expect(result).not.toHaveProperty('data');
    expect(result).not.toHaveProperty('statusCode');
  });

  it('handleRefundCallback 抛 HttpException 时仍返回微信格式', async () => {
    const { BadRequestException } = await import('@nestjs/common');
    mockService.handleRefundCallback.mockRejectedValue(new BadRequestException('退款单不存在'));
    const result = await controller.refundCallback(callbackBody(), {}, { rawBody: Buffer.from('') });
    expect(result).toEqual({ code: 'FAIL', message: '退款单不存在' });
  });

  it('handleRefundCallback 抛无 message 异常时使用默认文案', async () => {
    mockService.handleRefundCallback.mockRejectedValue({ stack: 'xxx' });
    const result = await controller.refundCallback(callbackBody(), {}, { rawBody: Buffer.from('') });
    expect(result).toEqual({ code: 'FAIL', message: '退款回调处理失败' });
  });
});

describe('PaymentCompensationController', () => {
  let controller: any;
  let mockService: any;

  beforeEach(() => {
    mockService = {
      getCompensationTaskList: jest.fn(),
      resolveCompensationTask: jest.fn(),
    };
    const { PaymentCompensationController } = require('./payment.controller');
    controller = new PaymentCompensationController(mockService);
  });

  it('resolveCompensationTask 合法 status=resolved 正常处理', async () => {
    mockService.resolveCompensationTask.mockResolvedValue({ id: '1', status: 'resolved' });
    const result = await controller.resolveCompensationTask('1', 'admin1', {
      resolution: '已处理',
      status: 'resolved',
    });
    expect(result.status).toBe('resolved');
    expect(mockService.resolveCompensationTask).toHaveBeenCalledWith('1', 'admin1', '已处理', 'resolved');
  });

  it('resolveCompensationTask 合法 status=ignored 正常处理', async () => {
    mockService.resolveCompensationTask.mockResolvedValue({ id: '2', status: 'ignored' });
    const result = await controller.resolveCompensationTask('2', 'admin1', {
      resolution: '忽略处理',
      status: 'ignored',
    });
    expect(result.status).toBe('ignored');
    expect(mockService.resolveCompensationTask).toHaveBeenCalledWith('2', 'admin1', '忽略处理', 'ignored');
  });
});
