import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PAYMENT_STATUS, REFUND_STATUS, COUPON_STATUS } from '../common/constants';
import { PaymentService } from './payment.service';
import { PaymentReconcileService } from './payment-reconcile.service';
import { BusinessEventService } from '../common/business-event.service';
import * as crypto from 'crypto';
import axios from 'axios';

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
    order: { findFirst: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
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
    paymentCompensationTask: { create: jest.fn(), findMany: jest.fn(), count: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
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

function createP2002Error(target: string[] | string) {
  return Object.assign(new Error('Unique constraint failed'), {
    code: 'P2002',
    meta: { target },
  });
}

function createPaymentService(mockPrisma?: any, mockConfigService?: any, mockBusinessEvent?: any) {
  const prisma = mockPrisma || createMockPrisma();
  if (prisma.$transaction && !prisma.$transaction.getMockImplementation?.()) {
    prisma.$transaction.mockImplementation(async (callback: any) => callback(prisma));
  }
  const configService = mockConfigService || createMockConfigService();
  const businessEvent = mockBusinessEvent || createMockBusinessEventService();
  const processFirstPaidReward = jest.fn() as any;
  processFirstPaidReward.mockResolvedValue(null);
  const mockShareService = { processFirstPaidReward };
  const mockOrderService = { generatePickupCode: jest.fn().mockImplementation(() => Promise.resolve('12345678')), assignUniquePickupCode: jest.fn().mockImplementation(() => Promise.resolve('12345678')) };
  const mockBenefitPackageService = { grantBenefitsForOrder: (jest.fn() as any).mockResolvedValue(null) };
  const service = new PaymentService(prisma as any, configService as any, businessEvent as any, mockOrderService as any, mockShareService as any, mockBenefitPackageService as any);
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
  'wechatpay-signature': 'sig', 'wechatpay-timestamp': Math.floor(Date.now() / 1000).toString(),
  'wechatpay-nonce': 'nonce', 'wechatpay-serial': 'test_serial',
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

  it('超时关单前确认：微信 SUCCESS 时修复订单并不进入 closable', async () => {
    const timeoutOrder = {
      id: BigInt(3),
      orderNo: 'ORDER789',
      status: 'pending_payment',
      payAmount: 10000,
      payment: { id: BigInt(3), status: PAYMENT_STATUS.CREATED },
    };
    mockPrisma.order.findMany.mockResolvedValue([timeoutOrder]);
    jest.spyOn(paymentService, 'queryWechatOrder').mockResolvedValue({
      trade_state: 'SUCCESS',
      transaction_id: 'TXN999',
      amount: { total: 10000 },
    });
    const processSpy = jest.spyOn(paymentService, 'processPaymentSuccess').mockResolvedValue(undefined as never);

    const result = await service.confirmTimeoutOrdersBeforeClose();

    expect(processSpy).toHaveBeenCalled();
    expect(result.fixed).toBe(1);
    expect(result.closable).toBe(0);
  });

  it('超时关单前确认：微信查询异常时延迟关闭一次', async () => {
    const timeoutOrder = {
      id: BigInt(4),
      orderNo: 'ORDER790',
      status: 'pending_payment',
      payAmount: 10000,
      payment: { id: BigInt(4), status: PAYMENT_STATUS.CREATED },
    };
    mockPrisma.order.findMany.mockResolvedValue([timeoutOrder]);
    jest.spyOn(paymentService, 'queryWechatOrder').mockRejectedValue(new Error('timeout'));
    mockPrisma.order.update.mockResolvedValue({});
    mockPrisma.orderLog.create.mockResolvedValue({});

    const result = await service.confirmTimeoutOrdersBeforeClose();

    expect(result.delayed).toBe(1);
    expect(mockPrisma.order.update).toHaveBeenCalled();
    expect(mockPrisma.orderLog.create).toHaveBeenCalled();
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
    mockPrisma.aftersaleOrder.findFirst.mockResolvedValue({
      id: BigInt(10),
      orderId: BigInt(1),
      orderItemId: BigInt(10),
      orderItem: { id: BigInt(10), subtotal: 10000 },
    });
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

  it('退款金额<=0时抛出 BadRequestException', async () => {
    mockPrisma.order.findFirst.mockResolvedValue(ORDER_RECORD);
    await expect(service.createRefund({ orderId: '1', refundAmount: 0 }))
      .rejects.toThrow('退款金额必须大于0分');
  });

  it('退款金额非整数分时抛出 BadRequestException', async () => {
    mockPrisma.order.findFirst.mockResolvedValue(ORDER_RECORD);
    await expect(service.createRefund({ orderId: '1', refundAmount: 1.5 as any }))
      .rejects.toThrow('退款金额必须是整数分');
  });

  it('累计退款超过 payAmount 时抛出 BadRequestException', async () => {
    mockPrisma.order.findFirst.mockResolvedValue(ORDER_RECORD);
    mockPrisma.orderRefund.findFirst.mockResolvedValue(null);
    mockPrisma.orderRefund.findMany.mockResolvedValue([{ refundAmount: 8000 }]);
    await expect(service.createRefund({ orderId: '1', refundAmount: 3000 }))
      .rejects.toThrow('累计退款金额不能超过订单实付金额');
  });

  it('售后退款金额超过该商品实付分摊可退金额时拒绝', async () => {
    mockPrisma.order.findFirst.mockResolvedValue({
      ...ORDER_RECORD,
      totalAmount: 10000,
      discountAmount: 0,
      couponAmount: 2000,
      pointsAmount: 0,
      activityDiscountAmount: 0,
      freightAmount: 0,
      payAmount: 8000,
      orderItems: [
        { id: BigInt(10), subtotal: 5000 },
        { id: BigInt(11), subtotal: 5000 },
      ],
      orderRefunds: [],
      aftersaleOrders: [{ id: BigInt(10), orderItemId: BigInt(10) }],
    });
    mockPrisma.orderRefund.findFirst.mockResolvedValue(null);
    mockPrisma.aftersaleOrder.findFirst.mockResolvedValue({
      id: BigInt(10),
      orderId: BigInt(1),
      orderItemId: BigInt(10),
      orderItem: { id: BigInt(10), subtotal: 5000 },
    });

    await expect(service.createRefund({ orderId: '1', aftersaleId: '10', refundAmount: 5000 }))
      .rejects.toThrow('退款金额不能超过该商品实付可退金额');
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
    const mockOrderService = { generatePickupCode: jest.fn().mockImplementation(() => Promise.resolve('12345678')) };
    const svc = new PaymentService(mockPrisma as any, configNoMock as any, mockBE as any, mockOrderService as any, mockShareService as any, { grantBenefitsForOrder: (jest.fn() as any).mockResolvedValue(null) } as any);
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

  it.each([
    'wechatpay-signature',
    'wechatpay-timestamp',
    'wechatpay-nonce',
    'wechatpay-serial',
  ])('缺少 %s 时返回 FAIL 且不验签', async (missingHeader) => {
    const headers = { ...CALLBACK_HEADERS };
    delete (headers as any)[missingHeader];
    const result = await service.handleRefundCallback(
      buildRefundCallbackBody(DECRYPTED_REFUND_SUCCESS), headers, RAW_BODY,
    );

    expect(result).toEqual({ code: 'FAIL', message: '缺少签名信息' });
    expect((service as any).verifyWechatSignature).not.toHaveBeenCalled();
  });

  it('回调 header 大小写不敏感', async () => {
    const result = await service.handleRefundCallback(
      {},
      {
        'Wechatpay-Signature': 'sig',
        'Wechatpay-Timestamp': Math.floor(Date.now() / 1000).toString(),
        'Wechatpay-Nonce': 'nonce',
        'Wechatpay-Serial': 'test_serial',
      },
      RAW_BODY,
    );

    expect(result.message).not.toBe('缺少签名信息');
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

  it('outRefundNo 找不到时返回 SUCCESS 并写入 RefundCallbackLog', async () => {
    mockPrisma.orderRefund.findFirst.mockResolvedValue(null);
    mockPrisma.refundCallbackLog.create.mockResolvedValue({ id: BigInt(1) });

    const result = await service.handleRefundCallback(
      buildRefundCallbackBody(DECRYPTED_REFUND_SUCCESS), CALLBACK_HEADERS, RAW_BODY,
    );

    expect(result.code).toBe('SUCCESS');
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
    expect(mockPrisma.pointsRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: 'aftersale_refund_deduct_reward',
          sourceId: AFTERSALE_RECORD.id,
        }),
      }),
    );
    expect(mockPrisma.pointsRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: 'aftersale_refund_restore_deducted',
          sourceId: AFTERSALE_RECORD.id,
        }),
      }),
    );
    expect(mockPrisma.orderRefund.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: REFUND_STATUS.SUCCESS }) }),
    );
  });

  it('积分不足扣回奖励积分时不阻断退款，并记录 business event', async () => {
    mockPrisma = createMockPrisma();
    const mockBE = createMockBusinessEventService();
    service = createPaymentService(mockPrisma, createMockConfigService(), mockBE);
    setupTransaction(mockPrisma);

    mockPrisma.orderRefund.findFirst.mockResolvedValue(REFUND_RECORD);
    mockPrisma.orderRefund.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.aftersaleOrder.findFirst
      .mockResolvedValueOnce(AFTERSALE_RECORD)
      .mockResolvedValueOnce(null);
    mockPrisma.aftersaleOrder.update.mockResolvedValue({});
    mockPrisma.productSku.findFirst.mockResolvedValue(SKU_RECORD);
    mockPrisma.productSku.update.mockResolvedValue({});
    mockPrisma.productStockLog.create.mockResolvedValue({});
    mockPrisma.user.findFirst.mockResolvedValue({ ...USER_RECORD, availablePoints: 1 });
    mockPrisma.user.update.mockResolvedValue({});
    mockPrisma.pointsRecord.create.mockResolvedValue({});
    mockPrisma.order.update.mockResolvedValue({});
    mockPrisma.orderRefund.update.mockResolvedValue({ status: REFUND_STATUS.SUCCESS });

    const result = await service.handleRefundCallback(
      buildRefundCallbackBody(DECRYPTED_REFUND_SUCCESS), CALLBACK_HEADERS, RAW_BODY,
    );

    expect(result.code).toBe('SUCCESS');
    expect(mockBE.emitWarn).toHaveBeenCalledWith(
      expect.stringContaining('aftersale_refund_deduct_points_insufficient'),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ requiredDeductedPoints: 10 }),
    );
  });

  it('同一订单两次不同售后退款可分别写入积分流水', async () => {
    setupTransaction(mockPrisma);
    const refundA = { ...REFUND_RECORD, id: BigInt(1), outRefundNo: 'REFUND_A', aftersaleId: BigInt(10) };
    const refundB = { ...REFUND_RECORD, id: BigInt(2), outRefundNo: 'REFUND_B', aftersaleId: BigInt(11) };
    const aftersaleA = { ...AFTERSALE_RECORD, id: BigInt(10), orderId: BigInt(100) };
    const aftersaleB = { ...AFTERSALE_RECORD, id: BigInt(11), orderId: BigInt(100) };

    mockPrisma.orderRefund.findFirst.mockResolvedValueOnce(refundA).mockResolvedValueOnce(refundB);
    mockPrisma.orderRefund.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.aftersaleOrder.findFirst
      .mockResolvedValueOnce(aftersaleA).mockResolvedValueOnce(null)
      .mockResolvedValueOnce(aftersaleB).mockResolvedValueOnce(null);
    mockPrisma.aftersaleOrder.update.mockResolvedValue({});
    mockPrisma.productSku.findFirst.mockResolvedValue(SKU_RECORD);
    mockPrisma.productSku.update.mockResolvedValue({});
    mockPrisma.productStockLog.create.mockResolvedValue({});
    mockPrisma.user.findFirst.mockResolvedValue(USER_RECORD);
    mockPrisma.user.update.mockResolvedValue({});
    mockPrisma.pointsRecord.create.mockResolvedValue({});
    mockPrisma.order.update.mockResolvedValue({});
    mockPrisma.orderRefund.update.mockResolvedValue({ status: REFUND_STATUS.SUCCESS });

    await service.handleRefundCallback(
      buildRefundCallbackBody({ ...DECRYPTED_REFUND_SUCCESS, out_refund_no: 'REFUND_A' }),
      CALLBACK_HEADERS,
      RAW_BODY,
    );
    await service.handleRefundCallback(
      buildRefundCallbackBody({ ...DECRYPTED_REFUND_SUCCESS, out_refund_no: 'REFUND_B' }),
      CALLBACK_HEADERS,
      RAW_BODY,
    );

    expect(mockPrisma.pointsRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: 'aftersale_refund_deduct_reward',
          sourceId: BigInt(10),
        }),
      }),
    );
    expect(mockPrisma.pointsRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: 'aftersale_refund_deduct_reward',
          sourceId: BigInt(11),
        }),
      }),
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

  it('本地 failed + 微信 SUCCESS 回调 → 补偿成功', async () => {
    const failedRefund = { ...REFUND_RECORD, status: REFUND_STATUS.FAILED };
    mockPrisma.orderRefund.findFirst.mockResolvedValue(failedRefund);
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
    expect(mockPrisma.orderRefund.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: REFUND_STATUS.SUCCESS }) }),
    );
    expect(mockPrisma.aftersaleOrder.update).toHaveBeenCalled();
  });

  it('本地 closed + 微信 SUCCESS 回调 → critical 事件 + FAIL', async () => {
    const closedRefund = { ...REFUND_RECORD, status: REFUND_STATUS.CLOSED };
    const mockBE = createMockBusinessEventService();
    service = createPaymentService(mockPrisma, undefined, mockBE);
    mockPrisma.orderRefund.findFirst.mockResolvedValue(closedRefund);

    const result = await service.handleRefundCallback(
      buildRefundCallbackBody(DECRYPTED_REFUND_SUCCESS), CALLBACK_HEADERS, RAW_BODY,
    );

    expect(result.code).toBe('FAIL');
    expect(result.message).toContain('终态');
    expect(mockBE.emitCritical).toHaveBeenCalledWith(
      'refund_terminal_status_conflict',
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ localStatus: REFUND_STATUS.CLOSED }),
    );
  });

  it('本地 abnormal + 微信 SUCCESS 回调 → critical 事件 + FAIL', async () => {
    const abnormalRefund = { ...REFUND_RECORD, status: REFUND_STATUS.ABNORMAL };
    const mockBE = createMockBusinessEventService();
    service = createPaymentService(mockPrisma, undefined, mockBE);
    mockPrisma.orderRefund.findFirst.mockResolvedValue(abnormalRefund);

    const result = await service.handleRefundCallback(
      buildRefundCallbackBody(DECRYPTED_REFUND_SUCCESS), CALLBACK_HEADERS, RAW_BODY,
    );

    expect(result.code).toBe('FAIL');
    expect(result.message).toContain('终态');
    expect(mockBE.emitCritical).toHaveBeenCalledWith(
      'refund_terminal_status_conflict',
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ localStatus: REFUND_STATUS.ABNORMAL }),
    );
  });

  it('重复 SUCCESS 回调不重复归还库存或积分', async () => {
    mockPrisma.orderRefund.findFirst.mockResolvedValue({ ...REFUND_RECORD, status: REFUND_STATUS.SUCCESS });

    const result = await service.handleRefundCallback(
      buildRefundCallbackBody(DECRYPTED_REFUND_SUCCESS), CALLBACK_HEADERS, RAW_BODY,
    );

    expect(result.code).toBe('SUCCESS');
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.productSku.update).not.toHaveBeenCalled();
    expect(mockPrisma.pointsRecord.create).not.toHaveBeenCalled();
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

  it.each([
    'wechatpay-signature',
    'wechatpay-timestamp',
    'wechatpay-nonce',
    'wechatpay-serial',
  ])('缺少 %s 时返回 FAIL 且不验签', async (missingHeader) => {
    const headers = { ...CALLBACK_HEADERS };
    delete (headers as any)[missingHeader];
    const result = await service.handleCallback(
      buildPaymentCallbackBody(DECRYPTED_PAYMENT_SUCCESS), headers, RAW_BODY,
    );

    expect(result).toEqual({ code: 'FAIL', message: '缺少签名信息' });
    expect((service as any).verifyWechatSignature).not.toHaveBeenCalled();
  });

  it('支付回调 header 大小写不敏感', async () => {
    const result = await service.handleCallback(
      {},
      {
        'Wechatpay-Signature': 'sig',
        'Wechatpay-Timestamp': Math.floor(Date.now() / 1000).toString(),
        'Wechatpay-Nonce': 'nonce',
        'Wechatpay-Serial': 'test_serial',
      },
      RAW_BODY,
    );

    expect(result.message).not.toBe('缺少签名信息');
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

  it('订单已取消时返回 SUCCESS 并创建补偿任务', async () => {
    const cancelledOrder = { ...PAYMENT_ORDER, status: 'cancelled' };
    mockPrisma.order.findFirst.mockResolvedValue(cancelledOrder);

    const result = await service.handleCallback(
      buildPaymentCallbackBody(DECRYPTED_PAYMENT_SUCCESS), CALLBACK_HEADERS, RAW_BODY,
    );

    expect(result.code).toBe('SUCCESS');
    expect(mockPrisma.paymentCompensationTask.create).toHaveBeenCalled();
  });
});

describe('PaymentService.processPaymentSuccess pickup code idempotency', () => {
  let service: PaymentService;
  let mockPrisma: any;
  let mockOrderService: any;

  const PICKUP_ORDER = { id: BigInt(1), orderNo: 'ORDER123', status: 'pending_payment', payAmount: 10000, fulfillmentType: 'pickup' };
  const PAYMENT_RECORD = { id: BigInt(1), orderId: BigInt(1), status: PAYMENT_STATUS.CREATED, transactionId: null };

  beforeEach(() => {
    mockOrderService = {
      generatePickupCode: jest.fn().mockImplementation(() => Promise.resolve('12345678')),
      assignUniquePickupCode: jest.fn().mockImplementation(() => Promise.resolve('12345678')),
    };
    const prisma = createMockPrisma();
    mockPrisma = prisma;
    const configService = createMockConfigService();
    const businessEvent = createMockBusinessEventService();
    const processFirstPaidReward = jest.fn() as any;
    processFirstPaidReward.mockResolvedValue(null);
    const mockShareService = { processFirstPaidReward };
    service = new PaymentService(prisma as any, configService as any, businessEvent as any, mockOrderService as any, mockShareService as any, { grantBenefitsForOrder: (jest.fn() as any).mockResolvedValue(null) } as any);
    jest.spyOn(service as any, 'verifyWechatSignature').mockReturnValue(true);
    jest.spyOn(service as any, 'isWechatPaymentConfigured').mockReturnValue(true);
    jest.spyOn(service['logger'], 'log').mockImplementation(() => {});
    jest.spyOn(service['logger'], 'warn').mockImplementation(() => {});
    jest.spyOn(service['logger'], 'error').mockImplementation(() => {});
  });

  it('pickup 订单首次支付成功会生成 pickupCode', async () => {
    setupTransaction(mockPrisma);
    mockPrisma.orderPayment.findUnique.mockResolvedValue(PAYMENT_RECORD);
    mockPrisma.order.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.orderPayment.update.mockResolvedValue({ status: PAYMENT_STATUS.SUCCESS });
    mockPrisma.orderLog.create.mockResolvedValue({});
    mockPrisma.userCoupon.findFirst.mockResolvedValue(null);

    await service.processPaymentSuccess(BigInt(1), BigInt(1), 'TXN456', 10000, PICKUP_ORDER);

    expect(mockOrderService.assignUniquePickupCode).toHaveBeenCalledWith(expect.anything(), BigInt(1));
  });

  it('同一个支付成功回调重复调用不会改变 pickupCode', async () => {
    setupTransaction(mockPrisma);
    const successPayment = { ...PAYMENT_RECORD, status: PAYMENT_STATUS.SUCCESS, transactionId: 'TXN456' };
    const processedOrder = { ...PICKUP_ORDER, status: 'pending_pickup' };

    mockPrisma.orderPayment.findUnique.mockResolvedValue(successPayment);
    mockPrisma.order.findUnique.mockResolvedValue(processedOrder);

    await service.processPaymentSuccess(BigInt(1), BigInt(1), 'TXN456', 10000, PICKUP_ORDER);

    expect(mockOrderService.assignUniquePickupCode).not.toHaveBeenCalled();
  });

  it('重复支付成功处理不重复触发首单奖励', async () => {
    const processFirstPaidReward = jest.fn() as any;
    processFirstPaidReward.mockResolvedValue(null);
    const prisma = createMockPrisma();
    mockPrisma = prisma;
    service = new PaymentService(
      prisma as any,
      createMockConfigService() as any,
      createMockBusinessEventService() as any,
      mockOrderService as any,
      { processFirstPaidReward } as any,
      { grantBenefitsForOrder: (jest.fn() as any).mockResolvedValue(null) } as any,
    );
    jest.spyOn(service['logger'], 'log').mockImplementation(() => {});
    jest.spyOn(service['logger'], 'warn').mockImplementation(() => {});
    jest.spyOn(service['logger'], 'error').mockImplementation(() => {});

    setupTransaction(mockPrisma);
    const successPayment = { ...PAYMENT_RECORD, status: PAYMENT_STATUS.SUCCESS, transactionId: 'TXN456' };
    const processedOrder = { ...PICKUP_ORDER, userId: BigInt(100), status: 'pending_pickup' };

    mockPrisma.orderPayment.findUnique.mockResolvedValue(successPayment);
    mockPrisma.order.findUnique.mockResolvedValue(processedOrder);

    await service.processPaymentSuccess(BigInt(1), BigInt(1), 'TXN456', 10000, processedOrder);

    expect(processFirstPaidReward).not.toHaveBeenCalled();
  });

  it('订单已被并发处理为 pending_pickup 时，标准支付成功分支不覆盖 pickupCode', async () => {
    setupTransaction(mockPrisma);
    mockPrisma.orderPayment.findUnique.mockResolvedValue(PAYMENT_RECORD);
    mockPrisma.order.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.order.findUnique.mockResolvedValue({ ...PICKUP_ORDER, status: 'pending_pickup', pickupCode: '87654321' });

    await service.processPaymentSuccess(BigInt(1), BigInt(1), 'TXN456', 10000, PICKUP_ORDER);

    expect(mockOrderService.assignUniquePickupCode).not.toHaveBeenCalled();
  });

  it('半成功补偿分支：updateResult.count > 0 时才调用 assignUniquePickupCode', async () => {
    const successPayment = { ...PAYMENT_RECORD, status: PAYMENT_STATUS.SUCCESS, transactionId: 'TXN456' };
    const halfSuccessOrder = { ...PICKUP_ORDER, status: 'pending_payment' };

    setupTransaction(mockPrisma);
    mockPrisma.orderPayment.findUnique.mockResolvedValue(successPayment);
    mockPrisma.order.findUnique.mockResolvedValue(halfSuccessOrder);
    mockPrisma.order.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.orderLog.create.mockResolvedValue({});
    mockPrisma.userCoupon.findFirst.mockResolvedValue(null);

    await service.processPaymentSuccess(BigInt(1), BigInt(1), 'TXN456', 10000, halfSuccessOrder);

    expect(mockOrderService.assignUniquePickupCode).toHaveBeenCalledWith(expect.anything(), BigInt(1));
  });

  it('半成功补偿分支：updateResult.count === 0 时不调用 assignUniquePickupCode', async () => {
    const successPayment = { ...PAYMENT_RECORD, status: PAYMENT_STATUS.SUCCESS, transactionId: 'TXN456' };
    const halfSuccessOrder = { ...PICKUP_ORDER, status: 'pending_payment' };

    setupTransaction(mockPrisma);
    mockPrisma.orderPayment.findUnique.mockResolvedValue(successPayment);
    mockPrisma.order.findUnique.mockResolvedValue(halfSuccessOrder);
    mockPrisma.order.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.processPaymentSuccess(BigInt(1), BigInt(1), 'TXN456', 10000, halfSuccessOrder))
      .rejects.toThrow('订单状态已变更，补偿失败');

    expect(mockOrderService.assignUniquePickupCode).not.toHaveBeenCalled();
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

  it('本地状态 failed 且微信 SUCCESS 时走补偿流程并记录 businessEvent', async () => {
    const mockBE = createMockBusinessEventService();
    service = createPaymentService(mockPrisma, undefined, mockBE);
    mockPrisma.orderRefund.findFirst.mockResolvedValue({ ...REFUND_RECORD, status: REFUND_STATUS.FAILED });
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
    expect(mockBE.emitWarn).toHaveBeenCalledWith(
      'refund_failed_to_success_recovery',
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ localStatus: REFUND_STATUS.FAILED }),
    );
  });

  it('本地状态 closed/abnormal 且微信 SUCCESS 时记录 critical 事件', async () => {
    const mockBE = createMockBusinessEventService();
    service = createPaymentService(mockPrisma, undefined, mockBE);
    mockPrisma.orderRefund.findFirst.mockResolvedValue({ ...REFUND_RECORD, status: REFUND_STATUS.CLOSED });
    jest.spyOn(service as any, 'queryRefund').mockResolvedValue({
      status: 'SUCCESS', refund_id: 'wx_refund_id', amount: { refund: 1000, total: 10000 },
    });

    const result = await service.syncRefund('REFUND123');

    expect(result.synced).toBe(false);
    expect(result.reason).toBe('terminal_status_conflict');
    expect(mockBE.emitCritical).toHaveBeenCalledWith(
      'refund_terminal_status_conflict',
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ localStatus: REFUND_STATUS.CLOSED }),
    );
  });
});

describe('BusinessEventService', () => {
  let service: PaymentService;
  let mockPrisma: any;
  let mockBusinessEvent: any;

  const PAYMENT_ORDER = { id: BigInt(1), orderNo: 'ORDER123', status: 'pending_payment', payAmount: 10000 };
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

  it('微信 JSAPI 下单 out_trade_no 使用业务订单号，paymentNo 仅作为内部支付单号', async () => {
    const mockedAxios = axios as jest.Mocked<typeof axios>;
    mockedAxios.post.mockClear();
    mockedAxios.post.mockResolvedValue({ data: { prepay_id: 'wx_prepay_id_123' } } as any);

    const ORDER = {
      id: BigInt(1), orderNo: 'ORDER123', status: 'pending_payment',
      payAmount: 10000, userId: BigInt(100),
      user: { id: BigInt(100), openid: 'test_openid' },
    };

    mockPrisma.order.findFirst.mockResolvedValue(ORDER);
    mockPrisma.orderPayment.findFirst.mockResolvedValue(null);
    (service as any).privateKey = 'test-private-key-present';
    jest.spyOn(service as any, 'signRequest').mockReturnValue('test-signature');

    const result = await service.createPayment('1', '100');

    const createdPayment = mockPrisma.orderPayment.create.mock.calls[0][0].data;
    expect(createdPayment.paymentNo).toEqual(expect.stringMatching(/^PAY/));
    expect(createdPayment.paymentNo).not.toBe(ORDER.orderNo);

    const jsapiCall = mockedAxios.post.mock.calls.find(([url]) => (
      url === 'https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi'
    ));
    expect(jsapiCall).toBeDefined();
    const requestBody = jsapiCall![1] as any;
    expect(requestBody.out_trade_no).toBe(ORDER.orderNo);
    expect(JSON.stringify(requestBody)).not.toContain(createdPayment.paymentNo);
    expect(result.package).toBe('prepay_id=wx_prepay_id_123');
  });

  it('同一订单重复创建支付复用已有有效支付单，不创建第二条支付记录', async () => {
    const ORDER = {
      id: BigInt(1), orderNo: 'ORDER123', status: 'pending_payment',
      payAmount: 10000, userId: BigInt(100),
      user: { id: BigInt(100), openid: 'test_openid' },
    };
    const EXISTING_PAYMENT = {
      id: BigInt(9), orderId: BigInt(1), paymentNo: 'PAY_EXISTING',
      amount: 10000, status: PAYMENT_STATUS.CREATED,
    };

    mockPrisma.order.findFirst.mockResolvedValue(ORDER);
    mockPrisma.orderPayment.findFirst.mockResolvedValue(EXISTING_PAYMENT);
    jest.spyOn(service, 'queryWechatOrder').mockResolvedValue({
      trade_state: 'NOTPAY',
      prepay_id: 'wx_existing_prepay_id',
    });
    const createWechatOrderSpy = jest.spyOn(service as any, 'createWechatOrder');

    const result = await service.createPayment('1', '100');

    expect(mockPrisma.orderPayment.create).not.toHaveBeenCalled();
    expect(createWechatOrderSpy).not.toHaveBeenCalled();
    expect(result.package).toBe('prepay_id=wx_existing_prepay_id');
  });

  it('并发两次创建同一订单支付时，第二次命中 orderId P2002 后复用已有支付记录', async () => {
    const ORDER = {
      id: BigInt(1), orderNo: 'ORDER123', status: 'pending_payment',
      payAmount: 10000, userId: BigInt(100),
      user: { id: BigInt(100), openid: 'test_openid' },
    };
    const EXISTING_PAYMENT = {
      id: BigInt(9), orderId: BigInt(1), paymentNo: 'PAY_EXISTING',
      amount: 10000, status: PAYMENT_STATUS.CREATED,
    };

    mockPrisma.order.findFirst.mockResolvedValue(ORDER);
    mockPrisma.orderPayment.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValue(EXISTING_PAYMENT);
    mockPrisma.orderPayment.create
      .mockResolvedValueOnce({ id: BigInt(8), orderId: BigInt(1), status: PAYMENT_STATUS.CREATED })
      .mockRejectedValueOnce(createP2002Error(['orderId']));
    jest.spyOn(service as any, 'createWechatOrder').mockResolvedValue('wx_new_prepay_id');
    jest.spyOn(service, 'queryWechatOrder').mockResolvedValue({
      trade_state: 'NOTPAY',
      prepay_id: 'wx_existing_prepay_id',
    });

    const results = await Promise.all([
      service.createPayment('1', '100'),
      service.createPayment('1', '100'),
    ]);

    expect(results.map((result) => result.package).sort()).toEqual([
      'prepay_id=wx_existing_prepay_id',
      'prepay_id=wx_new_prepay_id',
    ].sort());
    expect(mockPrisma.orderPayment.create).toHaveBeenCalledTimes(2);
    expect(mockPrisma.orderPayment.findFirst).toHaveBeenCalledWith({ where: { orderId: BigInt(1) } });
  });

  it('orderId P2002 时回查并复用已有 payment', async () => {
    const ORDER = {
      id: BigInt(1), orderNo: 'ORDER123', status: 'pending_payment',
      payAmount: 10000, userId: BigInt(100),
      user: { id: BigInt(100), openid: 'test_openid' },
    };
    const EXISTING_PAYMENT = {
      id: BigInt(9), orderId: BigInt(1), paymentNo: 'PAY_EXISTING',
      amount: 10000, status: PAYMENT_STATUS.CREATED,
    };

    mockPrisma.order.findFirst.mockResolvedValue(ORDER);
    mockPrisma.orderPayment.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(EXISTING_PAYMENT);
    mockPrisma.orderPayment.create.mockRejectedValueOnce(createP2002Error(['orderId']));
    jest.spyOn(service, 'queryWechatOrder').mockResolvedValue({
      trade_state: 'NOTPAY',
      prepay_id: 'wx_existing_prepay_id',
    });
    const createWechatOrderSpy = jest.spyOn(service as any, 'createWechatOrder');

    const result = await service.createPayment('1', '100');

    expect(result.package).toBe('prepay_id=wx_existing_prepay_id');
    expect(createWechatOrderSpy).not.toHaveBeenCalled();
    expect(mockPrisma.orderPayment.create).toHaveBeenCalledTimes(1);
  });

  it('paymentNo P2002 时重新生成支付单号并重试', async () => {
    const ORDER = {
      id: BigInt(1), orderNo: 'ORDER123', status: 'pending_payment',
      payAmount: 10000, userId: BigInt(100),
      user: { id: BigInt(100), openid: 'test_openid' },
    };

    mockPrisma.order.findFirst.mockResolvedValue(ORDER);
    mockPrisma.orderPayment.findFirst.mockResolvedValue(null);
    mockPrisma.orderPayment.create
      .mockRejectedValueOnce(createP2002Error(['paymentNo']))
      .mockResolvedValueOnce({ id: BigInt(8), orderId: BigInt(1), status: PAYMENT_STATUS.CREATED });
    jest.spyOn(service as any, 'createWechatOrder').mockResolvedValue('wx_new_prepay_id');

    const result = await service.createPayment('1', '100');

    expect(result.package).toBe('prepay_id=wx_new_prepay_id');
    expect(mockPrisma.orderPayment.create).toHaveBeenCalledTimes(2);
    const firstPaymentNo = mockPrisma.orderPayment.create.mock.calls[0][0].data.paymentNo;
    const secondPaymentNo = mockPrisma.orderPayment.create.mock.calls[1][0].data.paymentNo;
    expect(firstPaymentNo).toMatch(/^PAY/);
    expect(secondPaymentNo).toMatch(/^PAY/);
    expect(firstPaymentNo).not.toBe(secondPaymentNo);
  });

  it('支付成功回调金额不一致时拒绝并记录业务事件', async () => {
    const businessEvent = createMockBusinessEventService();
    service = createPaymentService(mockPrisma = createMockPrisma(), undefined, businessEvent);
    const ORDER = {
      id: BigInt(1), orderNo: 'ORDER123', status: 'pending_payment',
      payAmount: 10000, userId: BigInt(100),
    };
    const callbackData = {
      mchid: '1234567890',
      out_trade_no: 'ORDER123',
      transaction_id: 'TXN_MISMATCH',
      trade_state: 'SUCCESS',
      amount: { total: 9999 },
    };

    mockPrisma.order.findFirst.mockResolvedValue(ORDER);

    const result = await service.handleCallback(
      { resource: encryptCallbackData(callbackData) },
      { 'wechatpay-signature': 'sig', 'wechatpay-timestamp': Math.floor(Date.now() / 1000).toString(), 'wechatpay-nonce': 'nonce', 'wechatpay-serial': 'test_serial' },
      '{}',
    );

    expect(result).toEqual({ code: 'FAIL', message: '金额不匹配' });
    expect(businessEvent.emitCritical).toHaveBeenCalledWith(
      'payment_amount_mismatch',
      'payment',
      expect.stringContaining('金额不匹配'),
      'ORDER123',
      expect.objectContaining({ expected: 10000, actual: 9999, transactionId: 'TXN_MISMATCH' }),
    );
  });

  it('订单取消后收到支付成功回调创建补偿任务并返回成功给微信', async () => {
    const businessEvent = createMockBusinessEventService();
    service = createPaymentService(mockPrisma = createMockPrisma(), undefined, businessEvent);
    const createTaskSpy = jest.spyOn(service as any, 'createPaymentCompensationTask').mockResolvedValue({
      id: BigInt(1),
      orderNo: 'ORDER123',
      reason: 'cancelled_order_paid_callback',
    });
    const ORDER = {
      id: BigInt(1), orderNo: 'ORDER123', status: 'cancelled',
      payAmount: 10000, userId: BigInt(100),
    };
    const callbackData = {
      mchid: '1234567890',
      out_trade_no: 'ORDER123',
      transaction_id: 'TXN_CANCELLED',
      trade_state: 'SUCCESS',
      amount: { total: 10000 },
    };

    mockPrisma.order.findFirst.mockResolvedValue(ORDER);

    const result = await service.handleCallback(
      { resource: encryptCallbackData(callbackData) },
      { 'wechatpay-signature': 'sig', 'wechatpay-timestamp': Math.floor(Date.now() / 1000).toString(), 'wechatpay-nonce': 'nonce', 'wechatpay-serial': 'test_serial' },
      '{}',
    );

    expect(result).toEqual({ code: 'SUCCESS', message: '' });
    expect(businessEvent.emitCritical).toHaveBeenCalledWith(
      'payment_callback_on_cancelled_order',
      'payment',
      expect.stringContaining('已创建补偿任务'),
      'ORDER123',
      expect.objectContaining({ transactionId: 'TXN_CANCELLED', orderStatus: 'cancelled' }),
    );
    expect(createTaskSpy).toHaveBeenCalledWith(expect.objectContaining({
      orderNo: 'ORDER123',
      transactionId: 'TXN_CANCELLED',
      reason: 'cancelled_order_paid_callback',
    }));
  });

  it('0元订单已自动支付后调用 createPayment 抛出订单已支付', async () => {
    const ORDER = {
      id: BigInt(1), orderNo: 'ORDER123', status: 'pending_delivery',
      payAmount: 0, userId: BigInt(100),
      user: { id: BigInt(100), openid: 'test_openid' },
    };

    mockPrisma.order.findFirst.mockResolvedValue(ORDER);

    await expect(service.createPayment('1', '100'))
      .rejects.toThrow('订单已支付');
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
    expect(result.displayStatus).toBe('success');
  });

  it('getPaymentStatus 本地pending且微信SUCCESS时触发修复并返回success', async () => {
    const ORDER = { id: BigInt(1), orderNo: 'ORDER123', status: 'pending_payment', payAmount: 10000, userId: BigInt(100) };
    const PAYMENT = {
      id: BigInt(11),
      orderId: BigInt(1),
      status: PAYMENT_STATUS.CREATED,
      paymentMethod: 'wechat',
      amount: 10000,
      paidAt: null,
      transactionId: null,
    };
    const ORDER_AFTER = { id: BigInt(1), orderNo: 'ORDER123', status: 'pending_delivery' };
    const PAYMENT_AFTER = { ...PAYMENT, status: PAYMENT_STATUS.SUCCESS, paidAt: new Date(), transactionId: 'TXN123' };

    mockPrisma.order.findFirst.mockResolvedValueOnce(ORDER).mockResolvedValueOnce(ORDER_AFTER);
    mockPrisma.orderPayment.findFirst.mockResolvedValueOnce(PAYMENT).mockResolvedValueOnce(PAYMENT_AFTER);
    jest.spyOn(service, 'queryWechatOrder').mockResolvedValue({
      trade_state: 'SUCCESS',
      transaction_id: 'TXN123',
      amount: { total: 10000 },
    });
    const processSpy = jest.spyOn(service, 'processPaymentSuccess').mockResolvedValue(undefined as never);

    const result = await service.getPaymentStatus('1', '100');

    expect(processSpy).toHaveBeenCalled();
    expect(result.displayStatus).toBe('success');
    expect(result.orderStatus).toBe('pending_delivery');
  });

  it('支付回调和主动查单交错到达时通过 processPaymentSuccess 幂等保证最终成功', async () => {
    const ORDER = { id: BigInt(1), orderNo: 'ORDER123', status: 'pending_payment', payAmount: 10000, userId: BigInt(100) };
    const PAYMENT = {
      id: BigInt(11),
      orderId: BigInt(1),
      status: PAYMENT_STATUS.CREATED,
      paymentMethod: 'wechat',
      amount: 10000,
      paidAt: null,
      transactionId: null,
    };
    const ORDER_AFTER = { ...ORDER, status: 'pending_delivery' };
    const PAYMENT_AFTER = { ...PAYMENT, status: PAYMENT_STATUS.SUCCESS, paidAt: new Date(), transactionId: 'TXN123' };
    const processSpy = jest.spyOn(service, 'processPaymentSuccess')
      .mockResolvedValueOnce(undefined as never)
      .mockResolvedValueOnce(undefined as never);

    mockPrisma.order.findFirst
      .mockResolvedValueOnce(ORDER)
      .mockResolvedValueOnce(ORDER_AFTER);
    mockPrisma.orderPayment.findFirst
      .mockResolvedValueOnce(PAYMENT)
      .mockResolvedValueOnce(PAYMENT_AFTER);
    jest.spyOn(service, 'queryWechatOrder').mockResolvedValue({
      trade_state: 'SUCCESS',
      transaction_id: 'TXN123',
      amount: { total: 10000 },
    });

    const callbackData = {
      mchid: '1234567890',
      out_trade_no: 'ORDER123',
      transaction_id: 'TXN123',
      trade_state: 'SUCCESS',
      amount: { total: 10000 },
    };

    const callbackResult = await service.handleCallback(
      { resource: encryptCallbackData(callbackData) },
      { 'wechatpay-signature': 'sig', 'wechatpay-timestamp': Math.floor(Date.now() / 1000).toString(), 'wechatpay-nonce': 'nonce', 'wechatpay-serial': 'test_serial' },
      '{}',
    );
    const statusResult = await service.getPaymentStatus('1', '100');

    expect(callbackResult).toEqual({ code: 'SUCCESS', message: '' });
    expect(statusResult.displayStatus).toBe('success');
    expect(processSpy).toHaveBeenCalledTimes(1);
  });

  it('getPaymentStatus 微信NOTPAY/USERPAYING返回confirming而非失败', async () => {
    const ORDER = { id: BigInt(1), orderNo: 'ORDER123', status: 'pending_payment' };
    const PAYMENT = {
      id: BigInt(12),
      orderId: BigInt(1),
      status: PAYMENT_STATUS.CREATED,
      paymentMethod: 'wechat',
      amount: 10000,
      paidAt: null,
      transactionId: null,
    };
    mockPrisma.order.findFirst.mockResolvedValue(ORDER);
    mockPrisma.orderPayment.findFirst.mockResolvedValue(PAYMENT);
    jest.spyOn(service, 'queryWechatOrder').mockResolvedValue({ trade_state: 'NOTPAY' });

    const result = await service.getPaymentStatus('1', '100');

    expect(result.confirming).toBe(true);
    expect(result.displayStatus).toBe('pending');
  });

  it('getPaymentStatus 微信查询异常返回本地状态+confirming', async () => {
    const ORDER = { id: BigInt(1), orderNo: 'ORDER123', status: 'pending_payment' };
    const PAYMENT = {
      id: BigInt(13),
      orderId: BigInt(1),
      status: PAYMENT_STATUS.CREATED,
      paymentMethod: 'wechat',
      amount: 10000,
      paidAt: null,
      transactionId: null,
    };
    mockPrisma.order.findFirst.mockResolvedValue(ORDER);
    mockPrisma.orderPayment.findFirst.mockResolvedValue(PAYMENT);
    jest.spyOn(service, 'queryWechatOrder').mockRejectedValue(new Error('network'));

    const result = await service.getPaymentStatus('1', '100');

    expect(result.confirming).toBe(true);
    expect(result.displayStatus).toBe('confirming');
  });
});

describe('PaymentService 补偿任务管理', () => {
  let service: PaymentService;
  let mockPrisma: any;

  beforeEach(() => {
    service = createPaymentService(mockPrisma = createMockPrisma());
  });

  it('getCompensationTaskList 返回分页数据', async () => {
    mockPrisma.paymentCompensationTask.findMany.mockResolvedValue([
      { id: BigInt(1), orderNo: 'ORD001', status: 'pending', createdAt: new Date() },
    ]);
    mockPrisma.paymentCompensationTask.count.mockResolvedValue(1);

    const result = await service.getCompensationTaskList({ page: 1, pageSize: 20 });
    expect(result.pagination.total).toBe(1);
    expect(result.list[0].id).toBe('1');
  });

  it('resolveCompensationTask 更新处理结果', async () => {
    mockPrisma.paymentCompensationTask.findFirst.mockResolvedValue({ id: BigInt(1) });
    mockPrisma.paymentCompensationTask.update.mockResolvedValue({
      id: BigInt(1),
      status: 'resolved',
      handledBy: '100',
      resolution: 'manual refund created',
    });

    const result = await service.resolveCompensationTask('1', '100', 'manual refund created', 'resolved');
    expect(result.id).toBe('1');
    expect(mockPrisma.paymentCompensationTask.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: BigInt(1) },
        data: expect.objectContaining({ status: 'resolved', handledBy: '100' }),
      }),
    );
  });

  it('createPaymentCompensationTask 重复相同 transactionId 不重复创建', async () => {
    const createTask = (service as any).createPaymentCompensationTask.bind(service);
    const created = { id: BigInt(1), orderNo: 'ORD001', reason: 'cancelled_order_paid_callback', transactionId: 'TXN001' };
    mockPrisma.paymentCompensationTask.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(created);
    mockPrisma.paymentCompensationTask.create.mockResolvedValue(created);

    await createTask({ orderNo: 'ORD001', transactionId: 'TXN001', reason: 'cancelled_order_paid_callback' });
    await createTask({ orderNo: 'ORD001', transactionId: 'TXN001', reason: 'cancelled_order_paid_callback' });

    expect(mockPrisma.paymentCompensationTask.create).toHaveBeenCalledTimes(1);
  });

  it('createPaymentCompensationTask 首次调用创建成功', async () => {
    const createTask = (service as any).createPaymentCompensationTask.bind(service);
    const created = { id: BigInt(3), orderNo: 'ORD003', reason: 'cancelled_order_paid_callback', transactionId: 'TXN003' };
    mockPrisma.paymentCompensationTask.findFirst.mockResolvedValueOnce(null);
    mockPrisma.paymentCompensationTask.create.mockResolvedValue(created);

    const result = await createTask({ orderNo: 'ORD003', transactionId: 'TXN003', reason: 'cancelled_order_paid_callback' });

    expect(mockPrisma.paymentCompensationTask.create).toHaveBeenCalledTimes(1);
    expect(result).toEqual(created);
  });

  it('createPaymentCompensationTask transactionId 为空时按 orderNo+reason 幂等', async () => {
    const createTask = (service as any).createPaymentCompensationTask.bind(service);
    const created = { id: BigInt(2), orderNo: 'ORD002', reason: 'cancelled_order_paid_callback', transactionId: null };
    mockPrisma.paymentCompensationTask.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(created);
    mockPrisma.paymentCompensationTask.create.mockResolvedValue(created);

    await createTask({ orderNo: 'ORD002', reason: 'cancelled_order_paid_callback' });
    await createTask({ orderNo: 'ORD002', reason: 'cancelled_order_paid_callback' });

    expect(mockPrisma.paymentCompensationTask.create).toHaveBeenCalledTimes(1);
  });

  it('createPaymentCompensationTask 命中 P2002 时回查并返回已有任务', async () => {
    const createTask = (service as any).createPaymentCompensationTask.bind(service);
    const existing = { id: BigInt(4), orderNo: 'ORD004', reason: 'cancelled_order_paid_callback', transactionId: 'TXN004' };
    mockPrisma.paymentCompensationTask.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existing);
    mockPrisma.paymentCompensationTask.create.mockRejectedValue({ code: 'P2002' });

    const result = await createTask({ orderNo: 'ORD004', transactionId: 'TXN004', reason: 'cancelled_order_paid_callback' });

    expect(result).toEqual(existing);
    expect(mockPrisma.paymentCompensationTask.findFirst).toHaveBeenCalledTimes(2);
  });

  it('resolveCompensationTask 支持 ignored 并写入处理信息', async () => {
    mockPrisma.paymentCompensationTask.findFirst.mockResolvedValue({ id: BigInt(9) });
    mockPrisma.paymentCompensationTask.update.mockResolvedValue({
      id: BigInt(9),
      status: 'ignored',
      handledBy: 'admin',
      resolution: 'false alarm',
    });

    const result = await service.resolveCompensationTask('9', 'admin', 'false alarm', 'ignored');

    expect(result.status).toBe('ignored');
    expect(mockPrisma.paymentCompensationTask.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'ignored',
          handledBy: 'admin',
          resolution: 'false alarm',
          handledAt: expect.any(Date),
        }),
      }),
    );
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
    const mockOrderService = { generatePickupCode: jest.fn().mockImplementation(() => Promise.resolve('12345678')) };

    const mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);

    new PaymentService(mockPrisma as any, config as any, mockBE as any, mockOrderService as any, mockShareService as any, { grantBenefitsForOrder: (jest.fn() as any).mockResolvedValue(null) } as any);

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
    const mockOrderService = { generatePickupCode: jest.fn().mockImplementation(() => Promise.resolve('12345678')) };

    const mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);

    new PaymentService(mockPrisma as any, config as any, mockBE as any, mockOrderService as any, mockShareService as any, { grantBenefitsForOrder: (jest.fn() as any).mockResolvedValue(null) } as any);

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
    const mockOrderService = { generatePickupCode: jest.fn().mockImplementation(() => Promise.resolve('12345678')) };

    const mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);

    new PaymentService(mockPrisma as any, config as any, mockBE as any, mockOrderService as any, mockShareService as any, { grantBenefitsForOrder: (jest.fn() as any).mockResolvedValue(null) } as any);

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
    const mockOrderService = { generatePickupCode: jest.fn().mockImplementation(() => Promise.resolve('12345678')) };

    const mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);

    new PaymentService(mockPrisma as any, config as any, mockBE as any, mockOrderService as any, mockShareService as any, { grantBenefitsForOrder: (jest.fn() as any).mockResolvedValue(null) } as any);

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
    const mockOrderService = { generatePickupCode: jest.fn().mockImplementation(() => Promise.resolve('12345678')) };

    const mockExit = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);

    new PaymentService(mockPrisma as any, config as any, mockBE as any, mockOrderService as any, mockShareService as any, { grantBenefitsForOrder: (jest.fn() as any).mockResolvedValue(null) } as any);

    expect(mockExit).not.toHaveBeenCalled();
    mockExit.mockRestore();
  });
});

describe('PaymentService callback timestamp replay guard', () => {
  let service: PaymentService;

  beforeEach(() => {
    service = createPaymentService(createMockPrisma());
  });

  it('handleCallback — 正常时间戳通过', async () => {
    const validHeaders = {
      'wechatpay-signature': 'sig',
      'wechatpay-timestamp': Math.floor(Date.now() / 1000).toString(),
      'wechatpay-nonce': 'nonce',
      'wechatpay-serial': 'test_serial',
    };
    const result = await service.handleCallback({ resource: { ciphertext: '', nonce: '', associated_data: '' } }, validHeaders, '{}');
    expect(result.message).not.toBe('回调时间戳过期');
    expect(result.message).not.toBe('回调时间戳无效');
  });

  it('handleCallback — 超过 5 分钟的旧时间戳返回 FAIL', async () => {
    const expiredHeaders = {
      'wechatpay-signature': 'sig',
      'wechatpay-timestamp': '1234567890',
      'wechatpay-nonce': 'nonce',
      'wechatpay-serial': 'test_serial',
    };
    const result = await service.handleCallback({}, expiredHeaders, '{}');
    expect(result.code).toBe('FAIL');
    expect(result.message).toBe('回调时间戳过期');
  });

  it('handleCallback — 非数字 timestamp 返回 FAIL', async () => {
    const invalidHeaders = {
      'wechatpay-signature': 'sig',
      'wechatpay-timestamp': 'abc',
      'wechatpay-nonce': 'nonce',
      'wechatpay-serial': 'test_serial',
    };
    const result = await service.handleCallback({}, invalidHeaders, '{}');
    expect(result.code).toBe('FAIL');
    expect(result.message).toBe('回调时间戳无效');
  });

  it('handleRefundCallback — 超过 5 分钟的旧时间戳返回 FAIL', async () => {
    const expiredHeaders = {
      'wechatpay-signature': 'sig',
      'wechatpay-timestamp': '1234567890',
      'wechatpay-nonce': 'nonce',
      'wechatpay-serial': 'test_serial',
    };
    const result = await service.handleRefundCallback({}, expiredHeaders, '{}');
    expect(result.code).toBe('FAIL');
    expect(result.message).toBe('回调时间戳过期');
  });

  it('handleRefundCallback — 非数字 timestamp 返回 FAIL', async () => {
    const invalidHeaders = {
      'wechatpay-signature': 'sig',
      'wechatpay-timestamp': 'not-a-number',
      'wechatpay-nonce': 'nonce',
      'wechatpay-serial': 'test_serial',
    };
    const result = await service.handleRefundCallback({}, invalidHeaders, '{}');
    expect(result.code).toBe('FAIL');
    expect(result.message).toBe('回调时间戳无效');
  });
});

describe('PaymentService resolveCompensationTask 防御式校验', () => {
  let service: PaymentService;
  let mockPrisma: any;
  let mockConfigService: any;
  let mockBusinessEventService: any;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    mockConfigService = createMockConfigService();
    mockBusinessEventService = { emit: jest.fn() };
    service = new PaymentService(mockPrisma as any, mockConfigService as any, mockBusinessEventService as any, {} as any, {} as any, { grantBenefitsForOrder: (jest.fn() as any).mockResolvedValue(null) } as any);
  });

  it('非法 status 抛 BadRequestException', async () => {
    await expect(
      service.resolveCompensationTask('1', 'admin1', '测试', 'pending' as any),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.resolveCompensationTask('1', 'admin1', '测试', 'pending' as any),
    ).rejects.toThrow(/非法的 status 值: pending/);
  });

  it('合法 status=resolved 正常更新', async () => {
    mockPrisma.paymentCompensationTask.findFirst.mockResolvedValue({
      id: BigInt(1), status: 'pending', orderNo: 'ORD001',
    });
    mockPrisma.paymentCompensationTask.update.mockResolvedValue({
      id: BigInt(1), status: 'resolved', resolution: '已处理', handledBy: 'admin1',
    });
    const result = await service.resolveCompensationTask('1', 'admin1', '已处理', 'resolved');
    expect(result.status).toBe('resolved');
    expect(mockPrisma.paymentCompensationTask.update).toHaveBeenCalled();
  });

  it('合法 status=ignored 正常更新', async () => {
    mockPrisma.paymentCompensationTask.findFirst.mockResolvedValue({
      id: BigInt(2), status: 'pending', orderNo: 'ORD002',
    });
    mockPrisma.paymentCompensationTask.update.mockResolvedValue({
      id: BigInt(2), status: 'ignored', resolution: '忽略', handledBy: 'admin1',
    });
    const result = await service.resolveCompensationTask('2', 'admin1', '忽略', 'ignored');
    expect(result.status).toBe('ignored');
    expect(mockPrisma.paymentCompensationTask.update).toHaveBeenCalled();
  });
});
