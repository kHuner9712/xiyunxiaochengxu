import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PAYMENT_STATUS, REFUND_STATUS, WECHAT_REFUND_STATUS } from '../common/constants';
import { PaymentService } from './payment.service';
import { PaymentReconcileService } from './payment-reconcile.service';
import * as crypto from 'crypto';

jest.mock('axios');

const API_V3_KEY = '0123456789abcdef0123456789abcdef';

function encryptCallbackData(data: any) {
  const nonce = '123456789012';
  const nonceBuf = Buffer.from(nonce, 'utf8');
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(API_V3_KEY, 'utf8'), nonceBuf);
  const plaintext = Buffer.from(JSON.stringify(data), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const ciphertext = Buffer.concat([encrypted, authTag]);
  return { ciphertext: ciphertext.toString('base64'), associated_data: '', nonce };
}

function createMockPrisma() {
  return {
    order: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    orderRefund: { findFirst: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    orderPayment: { findFirst: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    aftersaleOrder: { findFirst: jest.fn(), update: jest.fn() },
    refundCallbackLog: { create: jest.fn(), findFirst: jest.fn() },
    orderLog: { create: jest.fn() },
    productSku: { findFirst: jest.fn(), update: jest.fn() },
    productStockLog: { create: jest.fn() },
    user: { findFirst: jest.fn(), update: jest.fn() },
    pointsRecord: { create: jest.fn() },
    $transaction: jest.fn(),
  };
}

function createMockConfigService(overrides?: Record<string, any>) {
  const config: Record<string, any> = {
    WECHAT_API_V3_KEY: API_V3_KEY,
    WECHAT_MCH_ID: '1234567890',
    WECHAT_PLATFORM_CERT_SERIAL_NO: '',
    WECHAT_PRIVATE_KEY_PATH: '',
    WECHAT_PLATFORM_CERT_PATH: '',
    NODE_ENV: 'test',
    WECHAT_SKIP_VERIFY: 'true',
    WECHAT_APP_ID: 'test_app_id',
    WECHAT_MCH_SERIAL_NO: 'test_serial',
    WECHAT_REFUND_NOTIFY_URL: 'http://localhost/callback',
    WECHAT_REFUND_MOCK: 'true',
    WECHAT_NOTIFY_URL: 'https://notify.example.com/pay',
    ...overrides,
  };
  return {
    get: jest.fn((key: string, defaultValue?: any) => config[key] ?? (defaultValue !== undefined ? defaultValue : '')),
  };
}

function createPaymentService(mockPrisma?: any, mockConfigService?: any) {
  const prisma = mockPrisma || createMockPrisma();
  const configService = mockConfigService || createMockConfigService();
  const service = new PaymentService(prisma as any, configService as any);
  jest.spyOn(service as any, 'verifyWechatSignature').mockReturnValue(true);
  jest.spyOn(service['logger'], 'log').mockImplementation(() => {});
  jest.spyOn(service['logger'], 'warn').mockImplementation(() => {});
  jest.spyOn(service['logger'], 'error').mockImplementation(() => {});
  return service;
}

function createReconcileService(mockPrisma?: any, paymentService?: PaymentService) {
  const prisma = mockPrisma || createMockPrisma();
  const ps = paymentService || createPaymentService(prisma);
  const service = new PaymentReconcileService(prisma as any, ps as any);
  jest.spyOn(service['logger'], 'log').mockImplementation(() => {});
  jest.spyOn(service['logger'], 'warn').mockImplementation(() => {});
  jest.spyOn(service['logger'], 'error').mockImplementation(() => {});
  return { service, mockPrisma: prisma, paymentService: ps };
}

function setupTransaction(mockPrisma: any) {
  mockPrisma.$transaction.mockImplementation(async (callback: any) => {
    const tx = {
      order: { findUnique: mockPrisma.order.findUnique, updateMany: mockPrisma.order.updateMany, update: mockPrisma.order.update },
      orderRefund: { findUnique: mockPrisma.orderRefund.findUnique, updateMany: mockPrisma.orderRefund.updateMany, update: mockPrisma.orderRefund.update, create: mockPrisma.orderRefund.create },
      orderPayment: { findUnique: mockPrisma.orderPayment.findUnique, update: mockPrisma.orderPayment.update },
      aftersaleOrder: { findFirst: mockPrisma.aftersaleOrder.findFirst, update: mockPrisma.aftersaleOrder.update },
      productSku: { findFirst: mockPrisma.productSku.findFirst, update: mockPrisma.productSku.update },
      productStockLog: { create: mockPrisma.productStockLog.create },
      user: { findFirst: mockPrisma.user.findFirst, update: mockPrisma.user.update },
      pointsRecord: { create: mockPrisma.pointsRecord.create },
      orderLog: { create: mockPrisma.orderLog.create },
    };
    return await callback(tx);
  });
}

const ORDER_RECORD = {
  id: BigInt(1), orderNo: 'ORDER123', status: 'aftersale', payAmount: 10000,
  payment: { id: BigInt(1), status: PAYMENT_STATUS.SUCCESS, transactionId: 'TXN123' },
};

const REFUND_RECORD = {
  id: BigInt(1), outRefundNo: 'REFUND123', refundAmount: 1000, totalAmount: 10000,
  status: REFUND_STATUS.PENDING, aftersaleId: BigInt(10),
};

const AFTERSALE_RECORD = {
  id: BigInt(10), orderId: BigInt(100), userId: BigInt(1000), type: 2, refundAmount: 1000,
  orderItem: { skuId: BigInt(200), productId: BigInt(300), quantity: 1 },
  order: { id: BigInt(100), payAmount: 10000, pointsDeducted: 500, completedAt: null },
};

const SKU_RECORD = { id: BigInt(200), stock: 50 };
const USER_RECORD = { id: BigInt(1000), availablePoints: 100 };

const DECRYPTED_REFUND_SUCCESS = {
  mchid: '1234567890', out_refund_no: 'REFUND123', refund_id: 'wx_refund_id',
  refund_status: 'SUCCESS', amount: { refund: 1000, total: 10000 },
};

function buildRefundCallbackBody(decryptedData: any) {
  return { resource: encryptCallbackData(decryptedData) };
}

const CALLBACK_HEADERS = {
  'wechatpay-signature': 'sig', 'wechatpay-timestamp': '1234567890',
  'wechatpay-nonce': 'nonce', 'wechatpay-serial': '',
};

const RAW_BODY = '{"resource":{}}';

describe('PaymentReconcileService.reconcilePendingPayments', () => {
  let service: PaymentReconcileService;
  let mockPrisma: any;
  let paymentService: PaymentService;

  beforeEach(() => {
    ({ service, mockPrisma, paymentService } = createReconcileService());
  });

  it('pending payment 经对账转 pending_delivery', async () => {
    const payment = {
      id: BigInt(1), orderId: BigInt(1), status: PAYMENT_STATUS.CREATED,
      order: { id: BigInt(1), orderNo: 'ORDER123', status: 'pending_payment', payAmount: 10000 },
    };

    mockPrisma.orderPayment.findMany.mockResolvedValue([payment]);

    jest.spyOn(paymentService, 'queryWechatOrder').mockResolvedValue({
      trade_state: 'SUCCESS', transaction_id: 'TXN456', amount: { total: 10000 },
    });

    setupTransaction(mockPrisma);
    mockPrisma.orderPayment.findUnique.mockResolvedValue({ ...payment, status: PAYMENT_STATUS.CREATED });
    mockPrisma.order.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.orderPayment.update.mockResolvedValue({ status: PAYMENT_STATUS.SUCCESS });
    mockPrisma.orderLog.create.mockResolvedValue({});

    const result = await service.reconcilePendingPayments();

    expect(result.fixed).toBe(1);
    expect(result.total).toBe(1);
    expect(mockPrisma.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'pending_delivery' }) }),
    );
  });

  it('query 微信失败不会破坏本地状态', async () => {
    const payment = {
      id: BigInt(1), orderId: BigInt(1), status: PAYMENT_STATUS.CREATED,
      order: { id: BigInt(1), orderNo: 'ORDER123', status: 'pending_payment', payAmount: 10000 },
    };

    mockPrisma.orderPayment.findMany.mockResolvedValue([payment]);

    jest.spyOn(paymentService, 'queryWechatOrder').mockRejectedValue(new Error('Network error'));

    const result = await service.reconcilePendingPayments();

    expect(result.failed).toBe(1);
    expect(result.fixed).toBe(0);
    expect(mockPrisma.order.updateMany).not.toHaveBeenCalled();
  });

  it('微信状态 CLOSED 时记录日志不修改订单', async () => {
    const payment = {
      id: BigInt(1), orderId: BigInt(1), status: PAYMENT_STATUS.CREATED,
      order: { id: BigInt(1), orderNo: 'ORDER123', status: 'pending_payment', payAmount: 10000 },
    };

    mockPrisma.orderPayment.findMany.mockResolvedValue([payment]);

    jest.spyOn(paymentService, 'queryWechatOrder').mockResolvedValue({
      trade_state: 'CLOSED',
    });

    const result = await service.reconcilePendingPayments();

    expect(result.skipped).toBe(1);
    expect(result.fixed).toBe(0);
    expect(mockPrisma.order.updateMany).not.toHaveBeenCalled();
  });

  it('订单已非 pending_payment 时跳过', async () => {
    const payment = {
      id: BigInt(1), orderId: BigInt(1), status: PAYMENT_STATUS.CREATED,
      order: { id: BigInt(1), orderNo: 'ORDER123', status: 'pending_delivery', payAmount: 10000 },
    };

    mockPrisma.orderPayment.findMany.mockResolvedValue([payment]);

    const result = await service.reconcilePendingPayments();

    expect(result.skipped).toBe(1);
    expect(result.fixed).toBe(0);
  });

  it('无待对账记录时返回空结果', async () => {
    mockPrisma.orderPayment.findMany.mockResolvedValue([]);

    const result = await service.reconcilePendingPayments();

    expect(result.total).toBe(0);
    expect(result.fixed).toBe(0);
  });
});

describe('PaymentReconcileService.reconcilePendingRefunds', () => {
  let service: PaymentReconcileService;
  let mockPrisma: any;
  let paymentService: PaymentService;

  beforeEach(() => {
    ({ service, mockPrisma, paymentService } = createReconcileService());
  });

  it('pending refund 经对账转 success', async () => {
    mockPrisma.orderRefund.findMany.mockResolvedValue([REFUND_RECORD]);

    jest.spyOn(paymentService, 'queryRefund').mockResolvedValue({
      status: 'SUCCESS', refund_id: 'wx_refund_id', amount: { refund: 1000, total: 10000 },
    });

    setupTransaction(mockPrisma);
    mockPrisma.orderRefund.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.aftersaleOrder.findFirst
      .mockResolvedValueOnce(AFTERSALE_RECORD)
      .mockResolvedValueOnce(null);
    mockPrisma.aftersaleOrder.update.mockResolvedValue({});
    mockPrisma.productSku.findFirst.mockResolvedValue(SKU_RECORD);
    mockPrisma.productSku.update.mockResolvedValue({});
    mockPrisma.productStockLog.create.mockResolvedValue({});
    mockPrisma.user.findFirst.mockResolvedValue(USER_RECORD);
    mockPrisma.user.update.mockResolvedValue({});
    mockPrisma.pointsRecord.create.mockResolvedValue({});
    mockPrisma.order.update.mockResolvedValue({});
    mockPrisma.orderRefund.update.mockResolvedValue({ status: REFUND_STATUS.SUCCESS });

    const result = await service.reconcilePendingRefunds();

    expect(result.fixed).toBe(1);
    expect(result.total).toBe(1);
    expect(mockPrisma.orderRefund.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: REFUND_STATUS.SUCCESS }) }),
    );
  });

  it('query 微信失败不会破坏本地状态', async () => {
    mockPrisma.orderRefund.findMany.mockResolvedValue([REFUND_RECORD]);

    jest.spyOn(paymentService, 'queryRefund').mockRejectedValue(new Error('Network error'));

    const result = await service.reconcilePendingRefunds();

    expect(result.failed).toBe(1);
    expect(result.fixed).toBe(0);
    expect(mockPrisma.orderRefund.update).not.toHaveBeenCalled();
  });

  it('微信 CLOSED 时同步本地状态', async () => {
    mockPrisma.orderRefund.findMany.mockResolvedValue([REFUND_RECORD]);

    jest.spyOn(paymentService, 'queryRefund').mockResolvedValue({
      status: 'CLOSED',
    });

    setupTransaction(mockPrisma);
    mockPrisma.orderRefund.update.mockResolvedValue({ status: REFUND_STATUS.CLOSED });
    mockPrisma.aftersaleOrder.update.mockResolvedValue({});

    const result = await service.reconcilePendingRefunds();

    expect(result.fixed).toBe(1);
    expect(mockPrisma.orderRefund.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: REFUND_STATUS.CLOSED }) }),
    );
  });

  it('微信 PROCESSING 且本地 initiating 时更新为 pending', async () => {
    mockPrisma.orderRefund.findMany.mockResolvedValue([{ ...REFUND_RECORD, status: REFUND_STATUS.INITIATING }]);

    jest.spyOn(paymentService, 'queryRefund').mockResolvedValue({
      status: 'PROCESSING', refund_id: 'wx_refund_id',
    });

    mockPrisma.orderRefund.update.mockResolvedValue({ status: REFUND_STATUS.PENDING });

    const result = await service.reconcilePendingRefunds();

    expect(result.fixed).toBe(1);
    expect(mockPrisma.orderRefund.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: REFUND_STATUS.PENDING }) }),
    );
  });

  it('金额不匹配时跳过不修复', async () => {
    mockPrisma.orderRefund.findMany.mockResolvedValue([REFUND_RECORD]);

    jest.spyOn(paymentService, 'queryRefund').mockResolvedValue({
      status: 'SUCCESS', refund_id: 'wx_refund_id', amount: { refund: 9999, total: 10000 },
    });

    const result = await service.reconcilePendingRefunds();

    expect(result.skipped).toBe(1);
    expect(result.fixed).toBe(0);
    expect(mockPrisma.orderRefund.update).not.toHaveBeenCalled();
  });

  it('无待对账记录时返回空结果', async () => {
    mockPrisma.orderRefund.findMany.mockResolvedValue([]);

    const result = await service.reconcilePendingRefunds();

    expect(result.total).toBe(0);
    expect(result.fixed).toBe(0);
  });
});

describe('PaymentService.createRefund', () => {
  let service: PaymentService;
  let mockPrisma: any;

  beforeEach(() => {
    service = createPaymentService(mockPrisma = createMockPrisma());
  });

  it('order 不存在时抛出 NotFoundException', async () => {
    mockPrisma.order.findFirst.mockResolvedValue(null);
    await expect(service.createRefund({ orderId: '999', refundAmount: 1000 }))
      .rejects.toThrow(NotFoundException);
  });

  it('order.status 不是 aftersale 时抛出 BadRequestException', async () => {
    mockPrisma.order.findFirst.mockResolvedValue({ ...ORDER_RECORD, status: 'pending_payment' });
    await expect(service.createRefund({ orderId: '1', refundAmount: 1000 }))
      .rejects.toThrow(BadRequestException);
  });

  it('order.payment 不存在时抛出 BadRequestException', async () => {
    mockPrisma.order.findFirst.mockResolvedValue({ ...ORDER_RECORD, payment: null });
    await expect(service.createRefund({ orderId: '1', refundAmount: 1000 }))
      .rejects.toThrow(BadRequestException);
  });

  it('order.payment.status 不是 SUCCESS 时抛出 BadRequestException', async () => {
    mockPrisma.order.findFirst.mockResolvedValue({
      ...ORDER_RECORD, payment: { id: BigInt(1), status: PAYMENT_STATUS.CREATED, transactionId: 'TXN123' },
    });
    await expect(service.createRefund({ orderId: '1', refundAmount: 1000 }))
      .rejects.toThrow('订单未支付成功');
  });

  it('累计退款超过 payAmount 时抛出 BadRequestException', async () => {
    mockPrisma.order.findFirst.mockResolvedValue(ORDER_RECORD);
    mockPrisma.orderRefund.findFirst.mockResolvedValue(null);
    mockPrisma.orderRefund.findMany.mockResolvedValue([{ refundAmount: 8000 }]);
    await expect(service.createRefund({ orderId: '1', refundAmount: 3000 }))
      .rejects.toThrow('累计退款金额不能超过订单实付金额');
  });

  it('同一 aftersaleId 已有 pending 退款时返回已有退款单，不重复调微信', async () => {
    const existingRefund = { id: BigInt(99), refundNo: 'R1', outRefundNo: 'OR1', status: REFUND_STATUS.PENDING };
    mockPrisma.order.findFirst.mockResolvedValue(ORDER_RECORD);
    mockPrisma.orderRefund.findFirst.mockResolvedValue(existingRefund);

    const result = await service.createRefund({ orderId: '1', aftersaleId: '10', refundAmount: 1000 });

    expect(result.outRefundNo).toBe('OR1');
    expect(mockPrisma.orderRefund.create).not.toHaveBeenCalled();
  });

  it('同一 aftersaleId 已有 success 退款时拒绝重复退款', async () => {
    const existingRefund = { id: BigInt(99), refundNo: 'R1', outRefundNo: 'OR1', status: REFUND_STATUS.SUCCESS };
    mockPrisma.order.findFirst.mockResolvedValue(ORDER_RECORD);
    mockPrisma.orderRefund.findFirst.mockResolvedValue(existingRefund);

    await expect(service.createRefund({ orderId: '1', aftersaleId: '10', refundAmount: 1000 }))
      .rejects.toThrow('该售后单已成功退款，请勿重复退款');
  });

  it('微信请求失败时 OrderRefund 标 failed，售后单不 pending_refund', async () => {
    mockPrisma.order.findFirst.mockResolvedValue(ORDER_RECORD);
    mockPrisma.orderRefund.findFirst.mockResolvedValue(null);
    mockPrisma.orderRefund.findMany.mockResolvedValue([]);

    const initiatingRecord = { id: BigInt(1), outRefundNo: 'REFUND123', status: REFUND_STATUS.INITIATING };
    mockPrisma.orderRefund.create.mockResolvedValue(initiatingRecord);
    mockPrisma.orderRefund.update.mockResolvedValue({ ...initiatingRecord, status: REFUND_STATUS.FAILED });

    const configNoMock = createMockConfigService({ WECHAT_REFUND_MOCK: 'false' });
    const svc = new PaymentService(mockPrisma as any, configNoMock as any);
    jest.spyOn(svc['logger'], 'log').mockImplementation(() => {});
    jest.spyOn(svc['logger'], 'warn').mockImplementation(() => {});
    jest.spyOn(svc['logger'], 'error').mockImplementation(() => {});

    await expect(svc.createRefund({ orderId: '1', aftersaleId: '10', refundAmount: 1000 }))
      .rejects.toThrow(BadRequestException);

    expect(mockPrisma.orderRefund.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: initiatingRecord.id },
        data: expect.objectContaining({ status: REFUND_STATUS.FAILED }),
      }),
    );
    expect(mockPrisma.aftersaleOrder.update).not.toHaveBeenCalled();
  });

  it('微信请求成功后创建/更新退款记录，售后进入 pending_refund', async () => {
    mockPrisma.order.findFirst.mockResolvedValue(ORDER_RECORD);
    mockPrisma.orderRefund.findFirst.mockResolvedValue(null);
    mockPrisma.orderRefund.findMany.mockResolvedValue([]);

    const initiatingRecord = { id: BigInt(1), outRefundNo: 'REFUND123', status: REFUND_STATUS.INITIATING };
    mockPrisma.orderRefund.create.mockResolvedValue(initiatingRecord);

    setupTransaction(mockPrisma);
    mockPrisma.orderRefund.update.mockResolvedValue({ ...initiatingRecord, status: REFUND_STATUS.PENDING });
    mockPrisma.aftersaleOrder.update.mockResolvedValue({});

    const result = await service.createRefund({ orderId: '1', aftersaleId: '10', refundAmount: 1000, reason: 'test' });

    expect(mockPrisma.orderRefund.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: REFUND_STATUS.INITIATING }),
      }),
    );
    expect(result.outRefundNo).toBeDefined();
  });

  it('微信成功后本地事务失败应保留 initiating 状态', async () => {
    mockPrisma.order.findFirst.mockResolvedValue(ORDER_RECORD);
    mockPrisma.orderRefund.findFirst.mockResolvedValue(null);
    mockPrisma.orderRefund.findMany.mockResolvedValue([]);

    const initiatingRecord = { id: BigInt(1), outRefundNo: 'REFUND123', status: REFUND_STATUS.INITIATING };
    mockPrisma.orderRefund.create.mockResolvedValue(initiatingRecord);
    mockPrisma.$transaction.mockRejectedValue(new Error('DB error'));

    await expect(service.createRefund({ orderId: '1', aftersaleId: '10', refundAmount: 1000 }))
      .rejects.toThrow(InternalServerErrorException);
  });
});

describe('PaymentService.handleRefundCallback', () => {
  let service: PaymentService;
  let mockPrisma: any;

  beforeEach(() => {
    service = createPaymentService(mockPrisma = createMockPrisma());
  });

  it('rawBody 缺失时返回 FAIL', async () => {
    const result = await service.handleRefundCallback(
      buildRefundCallbackBody(DECRYPTED_REFUND_SUCCESS), CALLBACK_HEADERS, undefined,
    );
    expect(result.code).toBe('FAIL');
    expect(result.message).toContain('rawBody');
  });

  it('签名验证失败时返回 FAIL', async () => {
    jest.spyOn(service as any, 'verifyWechatSignature').mockReturnValue(false);
    const result = await service.handleRefundCallback(
      buildRefundCallbackBody(DECRYPTED_REFUND_SUCCESS), CALLBACK_HEADERS, RAW_BODY,
    );
    expect(result.code).toBe('FAIL');
  });

  it('mchid 不一致时返回 FAIL', async () => {
    const mismatchData = { ...DECRYPTED_REFUND_SUCCESS, mchid: 'WRONG_MCH_ID' };
    const result = await service.handleRefundCallback(
      buildRefundCallbackBody(mismatchData), CALLBACK_HEADERS, RAW_BODY,
    );
    expect(result.code).toBe('FAIL');
    expect(result.message).toContain('商户号');
  });

  it('outRefundNo 找不到时返回 FAIL 并写入 RefundCallbackLog', async () => {
    mockPrisma.orderRefund.findFirst.mockResolvedValue(null);
    mockPrisma.refundCallbackLog.create.mockResolvedValue({ id: BigInt(1) });

    const result = await service.handleRefundCallback(
      buildRefundCallbackBody(DECRYPTED_REFUND_SUCCESS), CALLBACK_HEADERS, RAW_BODY,
    );

    expect(result.code).toBe('FAIL');
    expect(mockPrisma.refundCallbackLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ outRefundNo: 'REFUND123', status: 'orphan' }) }),
    );
  });

  it('金额不一致时返回 FAIL，不产生副作用', async () => {
    const mismatchData = { ...DECRYPTED_REFUND_SUCCESS, amount: { refund: 2000, total: 10000 } };
    mockPrisma.orderRefund.findFirst.mockResolvedValue(REFUND_RECORD);

    const result = await service.handleRefundCallback(
      buildRefundCallbackBody(mismatchData), CALLBACK_HEADERS, RAW_BODY,
    );

    expect(result.code).toBe('FAIL');
    expect(mockPrisma.orderRefund.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.aftersaleOrder.update).not.toHaveBeenCalled();
  });

  it('SUCCESS 正常路径：退款记录 success、售后 refunded、库存/积分处理', async () => {
    mockPrisma.orderRefund.findFirst.mockResolvedValue(REFUND_RECORD);
    setupTransaction(mockPrisma);

    mockPrisma.orderRefund.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.aftersaleOrder.findFirst
      .mockResolvedValueOnce(AFTERSALE_RECORD)
      .mockResolvedValueOnce(null);
    mockPrisma.aftersaleOrder.update.mockResolvedValue({});
    mockPrisma.productSku.findFirst.mockResolvedValue(SKU_RECORD);
    mockPrisma.productSku.update.mockResolvedValue({});
    mockPrisma.productStockLog.create.mockResolvedValue({});
    mockPrisma.user.findFirst.mockResolvedValue(USER_RECORD);
    mockPrisma.user.update.mockResolvedValue({});
    mockPrisma.pointsRecord.create.mockResolvedValue({});
    mockPrisma.order.update.mockResolvedValue({});
    mockPrisma.orderRefund.update.mockResolvedValue({ status: REFUND_STATUS.SUCCESS });

    const result = await service.handleRefundCallback(
      buildRefundCallbackBody(DECRYPTED_REFUND_SUCCESS), CALLBACK_HEADERS, RAW_BODY,
    );

    expect(result.code).toBe('SUCCESS');
    expect(mockPrisma.orderRefund.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: REFUND_STATUS.PROCESSING }) }),
    );
    expect(mockPrisma.aftersaleOrder.update).toHaveBeenCalled();
    expect(mockPrisma.productSku.update).toHaveBeenCalled();
    expect(mockPrisma.orderRefund.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: REFUND_STATUS.SUCCESS }) }),
    );
  });

  it('重复 SUCCESS 回调不重复处理副作用', async () => {
    mockPrisma.orderRefund.findFirst.mockResolvedValue({ ...REFUND_RECORD, status: REFUND_STATUS.SUCCESS });

    const result = await service.handleRefundCallback(
      buildRefundCallbackBody(DECRYPTED_REFUND_SUCCESS), CALLBACK_HEADERS, RAW_BODY,
    );

    expect(result.code).toBe('SUCCESS');
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('processing 状态返回 FAIL，不重复副作用', async () => {
    mockPrisma.orderRefund.findFirst.mockResolvedValue({ ...REFUND_RECORD, status: REFUND_STATUS.PROCESSING });

    const result = await service.handleRefundCallback(
      buildRefundCallbackBody(DECRYPTED_REFUND_SUCCESS), CALLBACK_HEADERS, RAW_BODY,
    );

    expect(result.code).toBe('FAIL');
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('副作用事务失败时 orderRefund 不会变成 success', async () => {
    mockPrisma.orderRefund.findFirst.mockResolvedValue(REFUND_RECORD);
    setupTransaction(mockPrisma);

    mockPrisma.orderRefund.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.aftersaleOrder.findFirst.mockResolvedValue(AFTERSALE_RECORD);
    mockPrisma.aftersaleOrder.update.mockRejectedValue(new Error('DB error'));

    const result = await service.handleRefundCallback(
      buildRefundCallbackBody(DECRYPTED_REFUND_SUCCESS), CALLBACK_HEADERS, RAW_BODY,
    );

    expect(result.code).toBe('FAIL');
    expect(result.message).toContain('重试');
  });

  it('成功路径最后才标记 success', async () => {
    mockPrisma.orderRefund.findFirst.mockResolvedValue(REFUND_RECORD);
    setupTransaction(mockPrisma);

    const callOrder: string[] = [];
    mockPrisma.orderRefund.updateMany.mockImplementation(() => { callOrder.push('claim'); return { count: 1 }; });
    mockPrisma.aftersaleOrder.findFirst.mockResolvedValueOnce(AFTERSALE_RECORD).mockResolvedValueOnce(null);
    mockPrisma.aftersaleOrder.update.mockImplementation(() => { callOrder.push('aftersale'); });
    mockPrisma.productSku.findFirst.mockResolvedValue(SKU_RECORD);
    mockPrisma.productSku.update.mockImplementation(() => { callOrder.push('sku'); });
    mockPrisma.productStockLog.create.mockImplementation(() => { callOrder.push('stockLog'); });
    mockPrisma.user.findFirst.mockResolvedValue(USER_RECORD);
    mockPrisma.user.update.mockImplementation(() => { callOrder.push('user'); });
    mockPrisma.pointsRecord.create.mockImplementation(() => { callOrder.push('points'); });
    mockPrisma.order.update.mockImplementation(() => { callOrder.push('order'); });
    mockPrisma.orderRefund.update.mockImplementation(() => { callOrder.push('success'); });

    const result = await service.handleRefundCallback(
      buildRefundCallbackBody(DECRYPTED_REFUND_SUCCESS), CALLBACK_HEADERS, RAW_BODY,
    );

    expect(result.code).toBe('SUCCESS');
    expect(callOrder[0]).toBe('claim');
    expect(callOrder[callOrder.length - 1]).toBe('success');
  });

  it('initiating 状态的退款记录可以被回调正常处理', async () => {
    mockPrisma.orderRefund.findFirst.mockResolvedValue({ ...REFUND_RECORD, status: REFUND_STATUS.INITIATING });
    setupTransaction(mockPrisma);

    mockPrisma.orderRefund.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.aftersaleOrder.findFirst.mockResolvedValue(null);
    mockPrisma.orderRefund.update.mockResolvedValue({ status: REFUND_STATUS.SUCCESS });

    const result = await service.handleRefundCallback(
      buildRefundCallbackBody(DECRYPTED_REFUND_SUCCESS), CALLBACK_HEADERS, RAW_BODY,
    );

    expect(result.code).toBe('SUCCESS');
  });

  it('CLOSED 回调更新本地状态为 closed', async () => {
    const closedData = { ...DECRYPTED_REFUND_SUCCESS, refund_status: 'CLOSED' };
    mockPrisma.orderRefund.findFirst.mockResolvedValue(REFUND_RECORD);
    setupTransaction(mockPrisma);

    mockPrisma.orderRefund.update.mockResolvedValue({ status: REFUND_STATUS.CLOSED });
    mockPrisma.aftersaleOrder.update.mockResolvedValue({});

    const result = await service.handleRefundCallback(
      buildRefundCallbackBody(closedData), CALLBACK_HEADERS, RAW_BODY,
    );

    expect(result.code).toBe('SUCCESS');
    expect(mockPrisma.orderRefund.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: REFUND_STATUS.CLOSED }) }),
    );
  });
});

describe('PaymentService.processPaymentSuccess (via handleCallback)', () => {
  let service: PaymentService;
  let mockPrisma: any;

  const PAYMENT_ORDER = { id: BigInt(1), orderNo: 'ORDER123', status: 'pending_payment', payAmount: 10000 };
  const PAYMENT_RECORD = { id: BigInt(1), orderId: BigInt(1), status: PAYMENT_STATUS.CREATED, transactionId: null };
  const DECRYPTED_PAYMENT_SUCCESS = {
    mchid: '1234567890', out_trade_no: 'ORDER123', transaction_id: 'TXN456',
    trade_state: 'SUCCESS', amount: { total: 10000 },
  };

  function buildPaymentCallbackBody(decryptedData: any) {
    return { resource: encryptCallbackData(decryptedData) };
  }

  beforeEach(() => {
    service = createPaymentService(mockPrisma = createMockPrisma());
  });

  it('pending_payment -> pending_delivery', async () => {
    mockPrisma.order.findFirst.mockResolvedValue(PAYMENT_ORDER);
    mockPrisma.orderPayment.findFirst.mockResolvedValue(PAYMENT_RECORD);

    setupTransaction(mockPrisma);
    mockPrisma.orderPayment.findUnique.mockResolvedValue(PAYMENT_RECORD);
    mockPrisma.order.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.orderPayment.update.mockResolvedValue({ status: PAYMENT_STATUS.SUCCESS });
    mockPrisma.orderLog.create.mockResolvedValue({});

    const result = await service.handleCallback(
      buildPaymentCallbackBody(DECRYPTED_PAYMENT_SUCCESS), CALLBACK_HEADERS, RAW_BODY,
    );

    expect(result.code).toBe('SUCCESS');
    expect(mockPrisma.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'pending_delivery' }) }),
    );
  });

  it('已 pending_delivery 且 payment success + transactionId 一致 -> 幂等', async () => {
    const processedOrder = { ...PAYMENT_ORDER, status: 'pending_delivery' };
    const processedPayment = { ...PAYMENT_RECORD, status: PAYMENT_STATUS.SUCCESS, transactionId: 'TXN456' };

    mockPrisma.order.findFirst.mockResolvedValue(processedOrder);

    const result = await service.handleCallback(
      buildPaymentCallbackBody(DECRYPTED_PAYMENT_SUCCESS), CALLBACK_HEADERS, RAW_BODY,
    );

    expect(result.code).toBe('SUCCESS');
    expect(mockPrisma.order.updateMany).not.toHaveBeenCalled();
  });

  it('payment success 但 transactionId 不一致 -> 抛出异常', async () => {
    const mismatchPayment = { ...PAYMENT_RECORD, status: PAYMENT_STATUS.SUCCESS, transactionId: 'TXN_DIFFERENT' };

    mockPrisma.order.findFirst.mockResolvedValue(PAYMENT_ORDER);
    mockPrisma.orderPayment.findFirst.mockResolvedValue(mismatchPayment);

    setupTransaction(mockPrisma);
    mockPrisma.orderPayment.findUnique.mockResolvedValue(mismatchPayment);

    await expect(service.handleCallback(
      buildPaymentCallbackBody(DECRYPTED_PAYMENT_SUCCESS), CALLBACK_HEADERS, RAW_BODY,
    )).rejects.toThrow('支付交易号不一致');
  });

  it('金额不匹配时返回 FAIL', async () => {
    const mismatchData = { ...DECRYPTED_PAYMENT_SUCCESS, amount: { total: 99999 } };
    mockPrisma.order.findFirst.mockResolvedValue(PAYMENT_ORDER);

    const result = await service.handleCallback(
      buildPaymentCallbackBody(mismatchData), CALLBACK_HEADERS, RAW_BODY,
    );

    expect(result.code).toBe('FAIL');
  });

  it('订单不存在时返回 FAIL', async () => {
    mockPrisma.order.findFirst.mockResolvedValue(null);

    const result = await service.handleCallback(
      buildPaymentCallbackBody(DECRYPTED_PAYMENT_SUCCESS), CALLBACK_HEADERS, RAW_BODY,
    );

    expect(result.code).toBe('FAIL');
  });

  it('rawBody 缺失时返回 FAIL', async () => {
    const result = await service.handleCallback(
      buildPaymentCallbackBody(DECRYPTED_PAYMENT_SUCCESS), CALLBACK_HEADERS, undefined,
    );
    expect(result.code).toBe('FAIL');
  });
});

describe('PaymentService.syncRefund', () => {
  let service: PaymentService;
  let mockPrisma: any;

  beforeEach(() => {
    service = createPaymentService(mockPrisma = createMockPrisma());
  });

  it('退款已成功时返回 already_success', async () => {
    mockPrisma.orderRefund.findFirst.mockResolvedValue({ ...REFUND_RECORD, status: REFUND_STATUS.SUCCESS });
    const result = await service.syncRefund('REFUND123');
    expect(result.synced).toBe(true);
    expect(result.reason).toBe('already_success');
  });

  it('退款不存在且无孤儿日志时抛出 NotFoundException', async () => {
    mockPrisma.orderRefund.findFirst.mockResolvedValue(null);
    mockPrisma.refundCallbackLog.findFirst.mockResolvedValue(null);
    await expect(service.syncRefund('NOTEXIST')).rejects.toThrow(NotFoundException);
  });

  it('退款不存在但有孤儿日志时返回 orphan_callback_found', async () => {
    mockPrisma.orderRefund.findFirst.mockResolvedValue(null);
    mockPrisma.refundCallbackLog.findFirst.mockResolvedValue({
      id: BigInt(1), outRefundNo: 'ORPHAN123', decryptedData: { refund_status: 'SUCCESS' }, createdAt: new Date(),
    });
    const result = await service.syncRefund('ORPHAN123');
    expect(result.synced).toBe(false);
    expect(result.reason).toBe('orphan_callback_found');
  });

  it('微信查询失败时返回 wechat_query_failed', async () => {
    mockPrisma.orderRefund.findFirst.mockResolvedValue({ ...REFUND_RECORD, status: REFUND_STATUS.INITIATING });
    jest.spyOn(service as any, 'queryRefund').mockRejectedValue(new Error('Network error'));
    const result = await service.syncRefund('REFUND123');
    expect(result.synced).toBe(false);
    expect(result.reason).toBe('wechat_query_failed');
  });

  it('微信状态 SUCCESS 且本地 initiating 时修复为 pending', async () => {
    mockPrisma.orderRefund.findFirst.mockResolvedValue({ ...REFUND_RECORD, status: REFUND_STATUS.INITIATING });
    jest.spyOn(service as any, 'queryRefund').mockResolvedValue({ status: 'SUCCESS', refund_id: 'wx_refund_id' });
    mockPrisma.orderRefund.update.mockResolvedValue({ status: REFUND_STATUS.PENDING });
    mockPrisma.aftersaleOrder.update.mockResolvedValue({});

    const result = await service.syncRefund('REFUND123');
    expect(result.synced).toBe(true);
    expect(result.reason).toBe('fixed_initiating_to_pending');
  });

  it('微信状态 CLOSED 时同步为本地 closed', async () => {
    mockPrisma.orderRefund.findFirst.mockResolvedValue({ ...REFUND_RECORD, status: REFUND_STATUS.INITIATING });
    jest.spyOn(service as any, 'queryRefund').mockResolvedValue({ status: 'CLOSED' });
    setupTransaction(mockPrisma);

    const result = await service.syncRefund('REFUND123');
    expect(result.synced).toBe(true);
    expect(result.reason).toBe('wechat_closed');
  });
});
