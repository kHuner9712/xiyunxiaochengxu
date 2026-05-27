import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PAYMENT_STATUS, REFUND_STATUS, WECHAT_REFUND_STATUS, COUPON_STATUS } from '../common/constants';
import { PaymentService } from './payment.service';
import { PaymentReconcileService } from './payment-reconcile.service';
import { BusinessEventService } from '../common/business-event.service';
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
    orderPayment: { findFirst: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
    aftersaleOrder: { findFirst: jest.fn(), update: jest.fn() },
    refundCallbackLog: { create: jest.fn(), findFirst: jest.fn(), updateMany: jest.fn() },
    orderLog: { create: jest.fn() },
    productSku: { findFirst: jest.fn(), update: jest.fn() },
    productStockLog: { create: jest.fn() },
    userCoupon: { findFirst: jest.fn(), update: jest.fn() },
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

function createMockBusinessEventService() {
  return {
    emit: jest.fn(),
    emitInfo: jest.fn(),
    emitWarn: jest.fn(),
    emitError: jest.fn(),
    emitCritical: jest.fn(),
  };
}

function createPaymentService(mockPrisma?: any, mockConfigService?: any, mockBusinessEvent?: any) {
  const prisma = mockPrisma || createMockPrisma();
  const configService = mockConfigService || createMockConfigService();
  const businessEvent = mockBusinessEvent || createMockBusinessEventService();
  const processFirstPaidReward = jest.fn() as any;
  processFirstPaidReward.mockResolvedValue(null);
  const mockShareService = { processFirstPaidReward };
  const mockOrderService = { generatePickupCode: jest.fn().mockImplementation(() => Promise.resolve('123456')) };
  const service = new PaymentService(prisma as any, configService as any, businessEvent as any, mockOrderService as any, mockShareService as any);
  jest.spyOn(service as any, 'verifyWechatSignature').mockReturnValue(true);
  jest.spyOn(service as any, 'isWechatPaymentConfigured').mockReturnValue(true);
  jest.spyOn(service['logger'], 'log').mockImplementation(() => {});
  jest.spyOn(service['logger'], 'warn').mockImplementation(() => {});
  jest.spyOn(service['logger'], 'error').mockImplementation(() => {});
  return service;
}

function createReconcileService(mockPrisma?: any, paymentService?: PaymentService, mockBusinessEvent?: any) {
  const prisma = mockPrisma || createMockPrisma();
  const ps = paymentService || createPaymentService(prisma);
  const businessEvent = mockBusinessEvent || createMockBusinessEventService();
  const service = new PaymentReconcileService(prisma as any, ps as any, businessEvent as any);
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
      userCoupon: { findFirst: mockPrisma.userCoupon.findFirst, update: mockPrisma.userCoupon.update },
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

    mockPrisma.orderPayment.findMany
      .mockResolvedValueOnce([payment])
      .mockResolvedValueOnce([]);

    jest.spyOn(paymentService, 'queryWechatOrder').mockResolvedValue({
      trade_state: 'SUCCESS', transaction_id: 'TXN456', amount: { total: 10000 },
    });

    setupTransaction(mockPrisma);
    mockPrisma.orderPayment.findUnique.mockResolvedValue({ ...payment, status: PAYMENT_STATUS.CREATED });
    mockPrisma.order.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.orderPayment.update.mockResolvedValue({ status: PAYMENT_STATUS.SUCCESS });
    mockPrisma.orderLog.create.mockResolvedValue({});
    mockPrisma.userCoupon.findFirst.mockResolvedValue(null);

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

    mockPrisma.orderPayment.findMany
      .mockResolvedValueOnce([payment])
      .mockResolvedValueOnce([]);

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

    mockPrisma.orderPayment.findMany
      .mockResolvedValueOnce([payment])
      .mockResolvedValueOnce([]);

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

    mockPrisma.orderPayment.findMany
      .mockResolvedValueOnce([payment])
      .mockResolvedValueOnce([]);

    const result = await service.reconcilePendingPayments();

    expect(result.skipped).toBe(1);
    expect(result.fixed).toBe(0);
  });

  it('无待对账记录时返回空结果', async () => {
    mockPrisma.orderPayment.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await service.reconcilePendingPayments();

    expect(result.total).toBe(0);
    expect(result.fixed).toBe(0);
  });

  it('支付半成功(payment SUCCESS + order pending_payment)经对账修复', async () => {
    const halfSuccessPayment = {
      id: BigInt(2), orderId: BigInt(2), status: PAYMENT_STATUS.SUCCESS, transactionId: 'TXN789',
      order: { id: BigInt(2), orderNo: 'ORDER456', status: 'pending_payment', payAmount: 10000 },
    };

    mockPrisma.orderPayment.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([halfSuccessPayment]);

    setupTransaction(mockPrisma);
    mockPrisma.orderPayment.findUnique.mockResolvedValue(halfSuccessPayment);
    mockPrisma.order.findUnique.mockResolvedValue(halfSuccessPayment.order);
    mockPrisma.order.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.orderLog.create.mockResolvedValue({});
    mockPrisma.userCoupon.findFirst.mockResolvedValue(null);

    const result = await service.reconcilePendingPayments();

    expect(result.fixed).toBe(1);
    expect(result.total).toBe(1);
    expect(mockPrisma.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'pending_delivery' }) }),
    );
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
    const mockBE = createMockBusinessEventService();
    const processFirstPaidReward = jest.fn() as any;
    processFirstPaidReward.mockResolvedValue(null);
    const mockShareService = { processFirstPaidReward };
    const mockOrderService = { generatePickupCode: jest.fn().mockImplementation(() => Promise.resolve('123456')) };
    const svc = new PaymentService(mockPrisma as any, configNoMock as any, mockBE as any, mockOrderService as any, mockShareService as any);
    jest.spyOn(svc as any, 'isWechatPaymentConfigured').mockReturnValue(true);
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
    mockPrisma.userCoupon.findFirst.mockResolvedValue(null);

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

  it('订单已取消时返回 FAIL 并记录 critical event', async () => {
    const cancelledOrder = { ...PAYMENT_ORDER, status: 'cancelled' };
    mockPrisma.order.findFirst.mockResolvedValue(cancelledOrder);

    const result = await service.handleCallback(
      buildPaymentCallbackBody(DECRYPTED_PAYMENT_SUCCESS), CALLBACK_HEADERS, RAW_BODY,
    );

    expect(result.code).toBe('FAIL');
    expect(result.message).toContain('已取消');
  });
});

describe('PaymentService.processPaymentSuccess (half-success compensation)', () => {
  let service: PaymentService;
  let mockPrisma: any;

  const HALF_SUCCESS_PAYMENT = { id: BigInt(1), orderId: BigInt(1), status: PAYMENT_STATUS.SUCCESS, transactionId: 'TXN456' };
  const HALF_SUCCESS_ORDER = { id: BigInt(1), orderNo: 'ORDER123', status: 'pending_payment', payAmount: 10000, couponId: BigInt(100) };

  beforeEach(() => {
    service = createPaymentService(mockPrisma = createMockPrisma());
  });

  it('payment SUCCESS + order pending_payment -> 补偿修复为 pending_delivery', async () => {
    setupTransaction(mockPrisma);
    mockPrisma.orderPayment.findUnique.mockResolvedValue(HALF_SUCCESS_PAYMENT);
    mockPrisma.order.findUnique.mockResolvedValue(HALF_SUCCESS_ORDER);
    mockPrisma.order.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.orderLog.create.mockResolvedValue({});
    mockPrisma.userCoupon.findFirst.mockResolvedValue(null);

    await service.processPaymentSuccess(BigInt(1), BigInt(1), 'TXN456', 10000, HALF_SUCCESS_ORDER);

    expect(mockPrisma.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'pending_payment' }),
        data: expect.objectContaining({ status: 'pending_delivery' }),
      }),
    );
    expect(mockPrisma.orderLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'payment_reconcile_fix' }),
      }),
    );
  });

  it('payment SUCCESS + order pending_payment + coupon LOCKED -> USED', async () => {
    setupTransaction(mockPrisma);
    mockPrisma.orderPayment.findUnique.mockResolvedValue(HALF_SUCCESS_PAYMENT);
    mockPrisma.order.findUnique.mockResolvedValue(HALF_SUCCESS_ORDER);
    mockPrisma.order.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.orderLog.create.mockResolvedValue({});
    mockPrisma.userCoupon.findFirst.mockResolvedValue({ id: BigInt(100), status: COUPON_STATUS.LOCKED });
    mockPrisma.userCoupon.update.mockResolvedValue({});

    await service.processPaymentSuccess(BigInt(1), BigInt(1), 'TXN456', 10000, HALF_SUCCESS_ORDER);

    expect(mockPrisma.userCoupon.update).toHaveBeenCalledWith({
      where: { id: BigInt(100) },
      data: { status: COUPON_STATUS.USED, usedAt: expect.any(Date) },
    });
  });

  it('payment SUCCESS + order pending_payment + coupon USED -> 幂等跳过', async () => {
    setupTransaction(mockPrisma);
    mockPrisma.orderPayment.findUnique.mockResolvedValue(HALF_SUCCESS_PAYMENT);
    mockPrisma.order.findUnique.mockResolvedValue(HALF_SUCCESS_ORDER);
    mockPrisma.order.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.orderLog.create.mockResolvedValue({});
    mockPrisma.userCoupon.findFirst.mockResolvedValue({ id: BigInt(100), status: COUPON_STATUS.USED });

    await service.processPaymentSuccess(BigInt(1), BigInt(1), 'TXN456', 10000, HALF_SUCCESS_ORDER);

    expect(mockPrisma.userCoupon.update).not.toHaveBeenCalled();
  });

  it('payment SUCCESS + order pending_payment + coupon FREE -> warn 不修改', async () => {
    setupTransaction(mockPrisma);
    mockPrisma.orderPayment.findUnique.mockResolvedValue(HALF_SUCCESS_PAYMENT);
    mockPrisma.order.findUnique.mockResolvedValue(HALF_SUCCESS_ORDER);
    mockPrisma.order.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.orderLog.create.mockResolvedValue({});
    mockPrisma.userCoupon.findFirst.mockResolvedValue({ id: BigInt(100), status: COUPON_STATUS.FREE });

    await service.processPaymentSuccess(BigInt(1), BigInt(1), 'TXN456', 10000, HALF_SUCCESS_ORDER);

    expect(mockPrisma.userCoupon.update).not.toHaveBeenCalled();
  });

  it('payment SUCCESS + order pending_payment + coupon EXPIRED -> warn 不修改', async () => {
    setupTransaction(mockPrisma);
    mockPrisma.orderPayment.findUnique.mockResolvedValue(HALF_SUCCESS_PAYMENT);
    mockPrisma.order.findUnique.mockResolvedValue(HALF_SUCCESS_ORDER);
    mockPrisma.order.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.orderLog.create.mockResolvedValue({});
    mockPrisma.userCoupon.findFirst.mockResolvedValue({ id: BigInt(100), status: COUPON_STATUS.EXPIRED });

    await service.processPaymentSuccess(BigInt(1), BigInt(1), 'TXN456', 10000, HALF_SUCCESS_ORDER);

    expect(mockPrisma.userCoupon.update).not.toHaveBeenCalled();
  });

  it('payment SUCCESS + order pending_delivery + coupon LOCKED -> 补偿 USED', async () => {
    const processedOrder = { ...HALF_SUCCESS_ORDER, status: 'pending_delivery' };
    setupTransaction(mockPrisma);
    mockPrisma.orderPayment.findUnique.mockResolvedValue(HALF_SUCCESS_PAYMENT);
    mockPrisma.order.findUnique.mockResolvedValue(processedOrder);
    mockPrisma.userCoupon.findFirst.mockResolvedValue({ id: BigInt(100), status: COUPON_STATUS.LOCKED });
    mockPrisma.userCoupon.update.mockResolvedValue({});

    await service.processPaymentSuccess(BigInt(1), BigInt(1), 'TXN456', 10000, processedOrder);

    expect(mockPrisma.userCoupon.update).toHaveBeenCalledWith({
      where: { id: BigInt(100) },
      data: { status: COUPON_STATUS.USED, usedAt: expect.any(Date) },
    });
    expect(mockPrisma.order.updateMany).not.toHaveBeenCalled();
  });

  it('payment SUCCESS + order pending_delivery + coupon USED -> 幂等', async () => {
    const processedOrder = { ...HALF_SUCCESS_ORDER, status: 'pending_delivery' };
    setupTransaction(mockPrisma);
    mockPrisma.orderPayment.findUnique.mockResolvedValue(HALF_SUCCESS_PAYMENT);
    mockPrisma.order.findUnique.mockResolvedValue(processedOrder);
    mockPrisma.userCoupon.findFirst.mockResolvedValue({ id: BigInt(100), status: COUPON_STATUS.USED });

    await service.processPaymentSuccess(BigInt(1), BigInt(1), 'TXN456', 10000, processedOrder);

    expect(mockPrisma.userCoupon.update).not.toHaveBeenCalled();
    expect(mockPrisma.order.updateMany).not.toHaveBeenCalled();
  });

  it('payment SUCCESS + order 异常状态 -> 抛错', async () => {
    const abnormalOrder = { ...HALF_SUCCESS_ORDER, status: 'cancelled' };
    setupTransaction(mockPrisma);
    mockPrisma.orderPayment.findUnique.mockResolvedValue(HALF_SUCCESS_PAYMENT);
    mockPrisma.order.findUnique.mockResolvedValue(abnormalOrder);
    mockPrisma.order.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.processPaymentSuccess(BigInt(1), BigInt(1), 'TXN456', 10000, abnormalOrder))
      .rejects.toThrow('订单已取消');
  });

  it('正常路径: coupon LOCKED -> USED', async () => {
    const orderWithCoupon = { ...HALF_SUCCESS_ORDER, status: 'pending_payment', couponId: BigInt(100) };
    const freshPayment = { id: BigInt(1), orderId: BigInt(1), status: PAYMENT_STATUS.CREATED, transactionId: null };

    setupTransaction(mockPrisma);
    mockPrisma.orderPayment.findUnique.mockResolvedValue(freshPayment);
    mockPrisma.order.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.orderPayment.update.mockResolvedValue({ status: PAYMENT_STATUS.SUCCESS });
    mockPrisma.orderLog.create.mockResolvedValue({});
    mockPrisma.userCoupon.findFirst.mockResolvedValue({ id: BigInt(100), status: COUPON_STATUS.LOCKED });
    mockPrisma.userCoupon.update.mockResolvedValue({});

    await service.processPaymentSuccess(BigInt(1), BigInt(1), 'TXN456', 10000, orderWithCoupon);

    expect(mockPrisma.userCoupon.update).toHaveBeenCalledWith({
      where: { id: BigInt(100) },
      data: { status: COUPON_STATUS.USED, usedAt: expect.any(Date) },
    });
  });

  it('正常路径: coupon USED -> 幂等跳过', async () => {
    const orderWithCoupon = { ...HALF_SUCCESS_ORDER, status: 'pending_payment', couponId: BigInt(100) };
    const freshPayment = { id: BigInt(1), orderId: BigInt(1), status: PAYMENT_STATUS.CREATED, transactionId: null };

    setupTransaction(mockPrisma);
    mockPrisma.orderPayment.findUnique.mockResolvedValue(freshPayment);
    mockPrisma.order.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.orderPayment.update.mockResolvedValue({ status: PAYMENT_STATUS.SUCCESS });
    mockPrisma.orderLog.create.mockResolvedValue({});
    mockPrisma.userCoupon.findFirst.mockResolvedValue({ id: BigInt(100), status: COUPON_STATUS.USED });

    await service.processPaymentSuccess(BigInt(1), BigInt(1), 'TXN456', 10000, orderWithCoupon);

    expect(mockPrisma.userCoupon.update).not.toHaveBeenCalled();
  });

  it('正常路径: coupon FREE -> warn 不修改', async () => {
    const orderWithCoupon = { ...HALF_SUCCESS_ORDER, status: 'pending_payment', couponId: BigInt(100) };
    const freshPayment = { id: BigInt(1), orderId: BigInt(1), status: PAYMENT_STATUS.CREATED, transactionId: null };

    setupTransaction(mockPrisma);
    mockPrisma.orderPayment.findUnique.mockResolvedValue(freshPayment);
    mockPrisma.order.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.orderPayment.update.mockResolvedValue({ status: PAYMENT_STATUS.SUCCESS });
    mockPrisma.orderLog.create.mockResolvedValue({});
    mockPrisma.userCoupon.findFirst.mockResolvedValue({ id: BigInt(100), status: COUPON_STATUS.FREE });

    await service.processPaymentSuccess(BigInt(1), BigInt(1), 'TXN456', 10000, orderWithCoupon);

    expect(mockPrisma.userCoupon.update).not.toHaveBeenCalled();
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

  it('微信状态 SUCCESS 且本地 initiating 时调用 processWechatRefundSuccess 完成副作用', async () => {
    mockPrisma.orderRefund.findFirst.mockResolvedValue({ ...REFUND_RECORD, status: REFUND_STATUS.INITIATING });
    jest.spyOn(service as any, 'queryRefund').mockResolvedValue({
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
    mockPrisma.refundCallbackLog.updateMany.mockResolvedValue({ count: 0 });

    const result = await service.syncRefund('REFUND123');

    expect(result.synced).toBe(true);
    expect(result.reason).toBe('wechat_success_processed');
    expect(mockPrisma.orderRefund.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: REFUND_STATUS.PROCESSING }) }),
    );
    expect(mockPrisma.orderRefund.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: REFUND_STATUS.SUCCESS }) }),
    );
    expect(mockPrisma.aftersaleOrder.update).toHaveBeenCalled();
    expect(mockPrisma.productSku.update).toHaveBeenCalled();
  });

  it('微信状态 SUCCESS 且本地 pending 时调用 processWechatRefundSuccess', async () => {
    mockPrisma.orderRefund.findFirst.mockResolvedValue({ ...REFUND_RECORD, status: REFUND_STATUS.PENDING });
    jest.spyOn(service as any, 'queryRefund').mockResolvedValue({
      status: 'SUCCESS', refund_id: 'wx_refund_id', amount: { refund: 1000, total: 10000 },
    });
    setupTransaction(mockPrisma);
    mockPrisma.orderRefund.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.aftersaleOrder.findFirst.mockResolvedValue(null);
    mockPrisma.orderRefund.update.mockResolvedValue({ status: REFUND_STATUS.SUCCESS });
    mockPrisma.refundCallbackLog.updateMany.mockResolvedValue({ count: 0 });

    const result = await service.syncRefund('REFUND123');

    expect(result.synced).toBe(true);
    expect(result.reason).toBe('wechat_success_processed');
    expect(mockPrisma.orderRefund.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: REFUND_STATUS.SUCCESS }) }),
    );
  });

  it('微信状态 SUCCESS 且本地 processing 时调用 processWechatRefundSuccess 补偿', async () => {
    mockPrisma.orderRefund.findFirst.mockResolvedValue({ ...REFUND_RECORD, status: REFUND_STATUS.PROCESSING });
    jest.spyOn(service as any, 'queryRefund').mockResolvedValue({
      status: 'SUCCESS', refund_id: 'wx_refund_id', amount: { refund: 1000, total: 10000 },
    });
    setupTransaction(mockPrisma);
    mockPrisma.orderRefund.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.aftersaleOrder.findFirst.mockResolvedValue(null);
    mockPrisma.orderRefund.update.mockResolvedValue({ status: REFUND_STATUS.SUCCESS });
    mockPrisma.refundCallbackLog.updateMany.mockResolvedValue({ count: 0 });

    const result = await service.syncRefund('REFUND123');

    expect(result.synced).toBe(true);
    expect(result.reason).toBe('wechat_success_processed');
    expect(mockPrisma.orderRefund.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: REFUND_STATUS.PROCESSING }) }),
    );
  });

  it('微信状态 SUCCESS 但退款金额不一致时不处理本地副作用', async () => {
    mockPrisma.orderRefund.findFirst.mockResolvedValue({ ...REFUND_RECORD, status: REFUND_STATUS.PENDING });
    jest.spyOn(service as any, 'queryRefund').mockResolvedValue({
      status: 'SUCCESS', refund_id: 'wx_refund_id', amount: { refund: 9999, total: 10000 },
    });

    const result = await service.syncRefund('REFUND123');

    expect(result.synced).toBe(false);
    expect(result.reason).toBe('amount_mismatch');
    expect(mockPrisma.orderRefund.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.orderRefund.update).not.toHaveBeenCalled();
    expect(mockPrisma.aftersaleOrder.update).not.toHaveBeenCalled();
  });

  it('微信状态 SUCCESS 但订单总金额不一致时不处理本地副作用', async () => {
    mockPrisma.orderRefund.findFirst.mockResolvedValue({ ...REFUND_RECORD, status: REFUND_STATUS.PENDING });
    jest.spyOn(service as any, 'queryRefund').mockResolvedValue({
      status: 'SUCCESS', refund_id: 'wx_refund_id', amount: { refund: 1000, total: 99999 },
    });

    const result = await service.syncRefund('REFUND123');

    expect(result.synced).toBe(false);
    expect(result.reason).toBe('total_amount_mismatch');
    expect(mockPrisma.orderRefund.updateMany).not.toHaveBeenCalled();
  });

  it('syncRefund 成功后标记孤儿回调日志为 processed', async () => {
    mockPrisma.orderRefund.findFirst.mockResolvedValue({ ...REFUND_RECORD, status: REFUND_STATUS.PENDING });
    jest.spyOn(service as any, 'queryRefund').mockResolvedValue({
      status: 'SUCCESS', refund_id: 'wx_refund_id', amount: { refund: 1000, total: 10000 },
    });
    setupTransaction(mockPrisma);
    mockPrisma.orderRefund.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.aftersaleOrder.findFirst.mockResolvedValue(null);
    mockPrisma.orderRefund.update.mockResolvedValue({ status: REFUND_STATUS.SUCCESS });
    mockPrisma.refundCallbackLog.updateMany.mockResolvedValue({ count: 2 });

    const result = await service.syncRefund('REFUND123');

    expect(result.synced).toBe(true);
    expect(result.reason).toBe('wechat_success_processed');
    expect(mockPrisma.refundCallbackLog.updateMany).toHaveBeenCalledWith({
      where: { outRefundNo: 'REFUND123', status: 'orphan' },
      data: { status: 'processed' },
    });
  });

  it('processWechatRefundSuccess 失败时返回 process_failed', async () => {
    mockPrisma.orderRefund.findFirst.mockResolvedValue({ ...REFUND_RECORD, status: REFUND_STATUS.PENDING });
    jest.spyOn(service as any, 'queryRefund').mockResolvedValue({
      status: 'SUCCESS', refund_id: 'wx_refund_id', amount: { refund: 1000, total: 10000 },
    });
    setupTransaction(mockPrisma);
    mockPrisma.orderRefund.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.aftersaleOrder.findFirst.mockRejectedValue(new Error('DB error'));

    const result = await service.syncRefund('REFUND123');

    expect(result.synced).toBe(false);
    expect(result.reason).toBe('process_failed');
    expect(mockPrisma.refundCallbackLog.updateMany).not.toHaveBeenCalled();
  });

  it('微信状态 CLOSED 时同步为本地 closed', async () => {
    mockPrisma.orderRefund.findFirst.mockResolvedValue({ ...REFUND_RECORD, status: REFUND_STATUS.INITIATING });
    jest.spyOn(service as any, 'queryRefund').mockResolvedValue({ status: 'CLOSED' });
    setupTransaction(mockPrisma);

    const result = await service.syncRefund('REFUND123');
    expect(result.synced).toBe(true);
    expect(result.reason).toBe('wechat_closed');
  });

  it('微信状态 PROCESSING 且本地 initiating 时更新为 pending', async () => {
    mockPrisma.orderRefund.findFirst.mockResolvedValue({ ...REFUND_RECORD, status: REFUND_STATUS.INITIATING });
    jest.spyOn(service as any, 'queryRefund').mockResolvedValue({ status: 'PROCESSING', refund_id: 'wx_refund_id' });
    mockPrisma.orderRefund.update.mockResolvedValue({ status: REFUND_STATUS.PENDING });
    mockPrisma.aftersaleOrder.update.mockResolvedValue({});

    const result = await service.syncRefund('REFUND123');

    expect(result.synced).toBe(true);
    expect(result.reason).toBe('wechat_processing');
    expect(mockPrisma.orderRefund.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: REFUND_STATUS.PENDING }) }),
    );
  });

  it('本地状态异常(failed/closed/abnormal)且微信 SUCCESS 时返回 unexpected_local_status', async () => {
    mockPrisma.orderRefund.findFirst.mockResolvedValue({ ...REFUND_RECORD, status: REFUND_STATUS.FAILED });
    jest.spyOn(service as any, 'queryRefund').mockResolvedValue({
      status: 'SUCCESS', refund_id: 'wx_refund_id', amount: { refund: 1000, total: 10000 },
    });

    const result = await service.syncRefund('REFUND123');

    expect(result.synced).toBe(false);
    expect(result.reason).toBe('unexpected_local_status');
    expect(mockPrisma.orderRefund.updateMany).not.toHaveBeenCalled();
  });
});

describe('BusinessEventService', () => {
  let service: PaymentService;
  let mockPrisma: any;
  let mockBusinessEvent: any;

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
    mockBusinessEvent = createMockBusinessEventService();
    service = createPaymentService(mockPrisma = createMockPrisma(), undefined, mockBusinessEvent);
  });

  it('支付回调金额不匹配时写 critical event', async () => {
    const mismatchData = { ...DECRYPTED_PAYMENT_SUCCESS, amount: { total: 99999 } };
    mockPrisma.order.findFirst.mockResolvedValue(PAYMENT_ORDER);

    await service.handleCallback(
      buildPaymentCallbackBody(mismatchData), CALLBACK_HEADERS, RAW_BODY,
    );

    expect(mockBusinessEvent.emitCritical).toHaveBeenCalledWith(
      'payment_amount_mismatch', 'payment', expect.stringContaining('金额不匹配'), 'ORDER123',
      expect.objectContaining({ expected: 10000, actual: 99999 }),
    );
  });

  it('支付回调订单不存在时写 error event', async () => {
    mockPrisma.order.findFirst.mockResolvedValue(null);

    await service.handleCallback(
      buildPaymentCallbackBody(DECRYPTED_PAYMENT_SUCCESS), CALLBACK_HEADERS, RAW_BODY,
    );

    expect(mockBusinessEvent.emitError).toHaveBeenCalledWith(
      'payment_order_not_found', 'payment', expect.stringContaining('订单不存在'), 'ORDER123',
      expect.objectContaining({ transactionId: 'TXN456' }),
    );
  });

  it('退款回调孤儿回调时写 critical event', async () => {
    mockPrisma.orderRefund.findFirst.mockResolvedValue(null);
    mockPrisma.refundCallbackLog.create.mockResolvedValue({});

    const refundCallbackData = {
      mchid: '1234567890', out_refund_no: 'REFUND_ORPHAN', refund_id: 'wx_refund_id',
      refund_status: 'SUCCESS', amount: { refund: 1000, total: 10000 },
    };

    await service.handleRefundCallback(
      { resource: encryptCallbackData(refundCallbackData) }, CALLBACK_HEADERS, RAW_BODY,
    );

    expect(mockBusinessEvent.emitCritical).toHaveBeenCalledWith(
      'refund_orphan_callback', 'refund', expect.stringContaining('孤儿回调'), 'REFUND_ORPHAN',
      expect.objectContaining({ outRefundNo: 'REFUND_ORPHAN' }),
    );
  });

  it('退款回调金额不匹配时写 critical event', async () => {
    const refund = { ...REFUND_RECORD, status: REFUND_STATUS.PENDING, refundAmount: 2000, totalAmount: 10000 };
    mockPrisma.orderRefund.findFirst.mockResolvedValue(refund);

    const refundCallbackData = {
      mchid: '1234567890', out_refund_no: 'REFUND123', refund_id: 'wx_refund_id',
      refund_status: 'SUCCESS', amount: { refund: 9999, total: 10000 },
    };

    await service.handleRefundCallback(
      { resource: encryptCallbackData(refundCallbackData) }, CALLBACK_HEADERS, RAW_BODY,
    );

    expect(mockBusinessEvent.emitCritical).toHaveBeenCalledWith(
      'refund_amount_mismatch', 'refund', expect.stringContaining('金额不匹配'), 'REFUND123',
      expect.objectContaining({ expected: 2000, actual: 9999 }),
    );
  });

  it('退款处理失败时写 error event', async () => {
    const refund = { ...REFUND_RECORD, status: REFUND_STATUS.PENDING, refundAmount: 1000, totalAmount: 10000 };
    mockPrisma.orderRefund.findFirst.mockResolvedValue(refund);
    setupTransaction(mockPrisma);
    mockPrisma.orderRefund.updateMany.mockRejectedValue(new Error('DB error'));

    const refundCallbackData = {
      mchid: '1234567890', out_refund_no: 'REFUND123', refund_id: 'wx_refund_id',
      refund_status: 'SUCCESS', amount: { refund: 1000, total: 10000 },
    };

    await service.handleRefundCallback(
      { resource: encryptCallbackData(refundCallbackData) }, CALLBACK_HEADERS, RAW_BODY,
    );

    expect(mockBusinessEvent.emitError).toHaveBeenCalledWith(
      'refund_processing_failed', 'refund', expect.stringContaining('退款处理失败'), 'REFUND123',
      expect.objectContaining({ outRefundNo: 'REFUND123' }),
    );
  });

  it('syncRefund 成功时写 info event', async () => {
    mockPrisma.orderRefund.findFirst.mockResolvedValue({ ...REFUND_RECORD, status: REFUND_STATUS.PENDING });
    jest.spyOn(service as any, 'queryRefund').mockResolvedValue({
      status: 'SUCCESS', refund_id: 'wx_refund_id', amount: { refund: 1000, total: 10000 },
    });
    setupTransaction(mockPrisma);
    mockPrisma.orderRefund.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.aftersaleOrder.findFirst.mockResolvedValue(null);
    mockPrisma.orderRefund.update.mockResolvedValue({ status: REFUND_STATUS.SUCCESS });
    mockPrisma.refundCallbackLog.updateMany.mockResolvedValue({ count: 0 });

    await service.syncRefund('REFUND123');

    expect(mockBusinessEvent.emitInfo).toHaveBeenCalledWith(
      'refund_sync_success', 'reconcile', expect.stringContaining('退款同步补偿成功'), 'REFUND123',
      expect.objectContaining({ outRefundNo: 'REFUND123' }),
    );
  });

  it('syncRefund 金额不匹配时写 critical event', async () => {
    mockPrisma.orderRefund.findFirst.mockResolvedValue({ ...REFUND_RECORD, status: REFUND_STATUS.PENDING });
    jest.spyOn(service as any, 'queryRefund').mockResolvedValue({
      status: 'SUCCESS', refund_id: 'wx_refund_id', amount: { refund: 9999, total: 10000 },
    });

    const result = await service.syncRefund('REFUND123');

    expect(result.synced).toBe(false);
    expect(result.reason).toBe('amount_mismatch');
    expect(mockBusinessEvent.emitCritical).toHaveBeenCalledWith(
      'refund_sync_amount_mismatch', 'refund', expect.stringContaining('金额不匹配'), 'REFUND123',
      expect.objectContaining({ expected: 1000, actual: 9999 }),
    );
  });
});

describe('BusinessEventService unit', () => {
  it('webhook 失败不影响主流程', async () => {
    const mockCreate = jest.fn(() => Promise.resolve({ id: BigInt(1) }));
    const mockPrisma = { businessEvent: { create: mockCreate } };
    const mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'ALERT_WEBHOOK_URL') return 'https://webhook.example.com/alert';
        return '';
      }),
    };

    const axiosPost = jest.fn(() => Promise.reject(new Error('Network error')));
    const originalPost = require('axios').post;
    require('axios').post = axiosPost;

    const service = new BusinessEventService(mockPrisma as any, mockConfigService as any);
    jest.spyOn(service['logger'], 'error').mockImplementation(() => {});

    await service.emitCritical('test_critical', 'payment', '测试 critical 事件', 'BIZ123', { key: 'value' });

    expect(mockCreate).toHaveBeenCalled();

    require('axios').post = originalPost;
  });

  it('emit 写入事件到数据库', async () => {
    const mockCreate = jest.fn(() => Promise.resolve({ id: BigInt(1) }));
    const mockPrisma = { businessEvent: { create: mockCreate } };
    const mockConfigService = { get: jest.fn(() => '') };

    const service = new BusinessEventService(mockPrisma as any, mockConfigService as any);

    await service.emit({
      eventType: 'test_event',
      bizType: 'payment',
      bizId: 'BIZ123',
      level: 'warn',
      message: '测试事件',
      payload: { key: 'value' },
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        eventType: 'test_event',
        bizType: 'payment',
        bizId: 'BIZ123',
        level: 'warn',
        message: '测试事件',
        payload: { key: 'value' },
      },
    });
  });

  it('emitInfo/emitWarn/emitError/emitCritical 设置正确的 level', async () => {
    const mockCreate = jest.fn(() => Promise.resolve({ id: BigInt(1) }));
    const mockPrisma = { businessEvent: { create: mockCreate } };
    const mockConfigService = { get: jest.fn(() => '') };

    const service = new BusinessEventService(mockPrisma as any, mockConfigService as any);

    await service.emitInfo('t', 'payment', 'msg');
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ level: 'info' }) }));

    await service.emitWarn('t', 'payment', 'msg');
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ level: 'warn' }) }));

    await service.emitError('t', 'payment', 'msg');
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ level: 'error' }) }));

    await service.emitCritical('t', 'payment', 'msg');
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ level: 'critical' }) }));
  });
});

describe('支付契约测试', () => {
  let service: PaymentService;
  let mockPrisma: any;

  beforeEach(() => {
    service = createPaymentService(mockPrisma = createMockPrisma());
    mockPrisma.orderPayment.create.mockResolvedValue({ id: BigInt(1) });
  });

  it('createPayment 返回结构应与 wx.requestPayment 参数一致', async () => {
    const ORDER = {
      id: BigInt(1), orderNo: 'ORDER123', status: 'pending_payment',
      payAmount: 10000, userId: BigInt(100),
      user: { id: BigInt(100), openid: 'test_openid' },
    };

    mockPrisma.order.findFirst.mockResolvedValue(ORDER);
    mockPrisma.orderPayment.findFirst.mockResolvedValue(null);

    jest.spyOn(service as any, 'createWechatOrder').mockResolvedValue('wx_prepay_id_123');

    const result = await service.createPayment('1', '100');

    expect(result).toHaveProperty('timeStamp');
    expect(result).toHaveProperty('nonceStr');
    expect(result).toHaveProperty('package');
    expect(result).toHaveProperty('signType');
    expect(result).toHaveProperty('paySign');
    expect(result.signType).toBe('RSA');
    expect(result.package).toBe('prepay_id=wx_prepay_id_123');
  });

  it('getPaymentStatus 应返回正确的支付状态', async () => {
    const ORDER = {
      id: BigInt(1), orderNo: 'ORDER123', status: 'pending_delivery',
    };
    const PAYMENT = {
      id: BigInt(1), orderId: BigInt(1), status: PAYMENT_STATUS.SUCCESS,
      paymentMethod: 'wechat', amount: 10000, paidAt: new Date(), transactionId: 'TXN456',
    };

    mockPrisma.order.findFirst.mockResolvedValue(ORDER);
    mockPrisma.orderPayment.findFirst.mockResolvedValue(PAYMENT);

    const result = await service.getPaymentStatus('1', '100');

    expect(result).toHaveProperty('orderId');
    expect(result).toHaveProperty('orderNo');
    expect(result).toHaveProperty('orderStatus');
    expect(result).toHaveProperty('paymentStatus');
    expect(result.orderId).toBe('1');
    expect(result.orderNo).toBe('ORDER123');
    expect(result.orderStatus).toBe('pending_delivery');
    expect(result.paymentStatus).toBe(PAYMENT_STATUS.SUCCESS);
  });
});

describe('PaymentService 生产环境配置校验', () => {
  it('生产环境缺少 WECHAT_APP_ID 应启动失败', () => {
    const mockPrisma = createMockPrisma();
    const config = createMockConfigService({ NODE_ENV: 'production', WECHAT_APP_ID: '' });
    const mockBE = createMockBusinessEventService();
    const processFirstPaidReward = jest.fn() as any;
    processFirstPaidReward.mockResolvedValue(null);
    const mockShareService = { processFirstPaidReward };
    const mockOrderService = { generatePickupCode: jest.fn().mockImplementation(() => Promise.resolve('123456')) };

    const mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);

    new PaymentService(mockPrisma as any, config as any, mockBE as any, mockOrderService as any, mockShareService as any);

    expect(mockExit).toHaveBeenCalledWith(1);
    mockExit.mockRestore();
  });

  it('生产环境 WECHAT_API_V3_KEY 不为32字节应启动失败', () => {
    const mockPrisma = createMockPrisma();
    const config = createMockConfigService({
      NODE_ENV: 'production',
      WECHAT_API_V3_KEY: 'short_key',
      WECHAT_APP_ID: 'wx123',
      WECHAT_MCH_ID: '123',
      WECHAT_MCH_SERIAL_NO: 'serial',
      WECHAT_PRIVATE_KEY_PATH: '',
      WECHAT_PLATFORM_CERT_PATH: '',
      WECHAT_NOTIFY_URL: 'https://example.com/callback',
      WECHAT_REFUND_NOTIFY_URL: 'https://example.com/refund',
    });
    const mockBE = createMockBusinessEventService();
    const processFirstPaidReward = jest.fn() as any;
    processFirstPaidReward.mockResolvedValue(null);
    const mockShareService = { processFirstPaidReward };
    const mockOrderService = { generatePickupCode: jest.fn().mockImplementation(() => Promise.resolve('123456')) };

    const mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);

    new PaymentService(mockPrisma as any, config as any, mockBE as any, mockOrderService as any, mockShareService as any);

    expect(mockExit).toHaveBeenCalledWith(1);
    mockExit.mockRestore();
  });

  it('生产环境 WECHAT_NOTIFY_URL 不是 https 应启动失败', () => {
    const mockPrisma = createMockPrisma();
    const config = createMockConfigService({
      NODE_ENV: 'production',
      WECHAT_NOTIFY_URL: 'http://example.com/callback',
    });
    const mockBE = createMockBusinessEventService();
    const processFirstPaidReward = jest.fn() as any;
    processFirstPaidReward.mockResolvedValue(null);
    const mockShareService = { processFirstPaidReward };
    const mockOrderService = { generatePickupCode: jest.fn().mockImplementation(() => Promise.resolve('123456')) };

    const mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);

    new PaymentService(mockPrisma as any, config as any, mockBE as any, mockOrderService as any, mockShareService as any);

    expect(mockExit).toHaveBeenCalledWith(1);
    mockExit.mockRestore();
  });

  it('生产环境 WECHAT_SKIP_VERIFY=true 应启动失败', () => {
    const mockPrisma = createMockPrisma();
    const config = createMockConfigService({
      NODE_ENV: 'production',
      WECHAT_SKIP_VERIFY: 'true',
    });
    const mockBE = createMockBusinessEventService();
    const processFirstPaidReward = jest.fn() as any;
    processFirstPaidReward.mockResolvedValue(null);
    const mockShareService = { processFirstPaidReward };
    const mockOrderService = { generatePickupCode: jest.fn().mockImplementation(() => Promise.resolve('123456')) };

    const mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);

    new PaymentService(mockPrisma as any, config as any, mockBE as any, mockOrderService as any, mockShareService as any);

    expect(mockExit).toHaveBeenCalledWith(1);
    mockExit.mockRestore();
  });

  it('非生产环境缺少支付配置应仅 warn 不退出', () => {
    const mockPrisma = createMockPrisma();
    const config = createMockConfigService({
      NODE_ENV: 'development',
      WECHAT_APP_ID: '',
      WECHAT_MCH_ID: '',
    });
    const mockBE = createMockBusinessEventService();
    const processFirstPaidReward = jest.fn() as any;
    processFirstPaidReward.mockResolvedValue(null);
    const mockShareService = { processFirstPaidReward };
    const mockOrderService = { generatePickupCode: jest.fn().mockImplementation(() => Promise.resolve('123456')) };

    const mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);

    new PaymentService(mockPrisma as any, config as any, mockBE as any, mockOrderService as any, mockShareService as any);

    expect(mockExit).not.toHaveBeenCalled();
    mockExit.mockRestore();
  });
});
