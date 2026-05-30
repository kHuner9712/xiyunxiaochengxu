import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AftersaleStatus, OrderStatus } from '@prisma/client';
import { AftersaleService } from './aftersale.service';

function createMockPrisma() {
  const mockTx = {
    aftersaleOrder: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    order: { update: jest.fn() },
    aftersaleLog: { create: jest.fn() },
  };

  return {
    orderItem: { findFirst: jest.fn() },
    aftersaleOrder: { findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), update: jest.fn() },
    aftersaleLog: { create: jest.fn() },
    $transaction: jest.fn(),
    _mockTx: mockTx,
  };
}

function createMockPaymentService() {
  return {
    createRefund: jest.fn(),
  };
}

function createService(mockPrisma?: any, mockPayment?: any) {
  const prisma = mockPrisma || createMockPrisma();
  const payment = mockPayment || createMockPaymentService();
  const service = new AftersaleService(prisma as any, payment as any);
  jest.spyOn(service['logger'], 'log').mockImplementation(() => {});
  jest.spyOn(service['logger'], 'error').mockImplementation(() => {});
  jest.spyOn(service['logger'], 'warn').mockImplementation(() => {});
  return { service, mockPrisma: prisma, mockPayment: payment };
}

function setupTransaction(mockPrisma: any) {
  mockPrisma.$transaction.mockImplementation(async (callback: any) => {
    return await callback(mockPrisma._mockTx);
  });
}

const ORDER_ITEM_WITH_DELIVERED_ORDER = {
  id: BigInt(10), orderId: BigInt(1), skuId: BigInt(200), productId: BigInt(300), subtotal: 9900,
  order: { id: BigInt(1), userId: BigInt(100), status: OrderStatus.delivered, completedAt: null },
};

const APPROVED_AFTERSALE = {
  id: BigInt(50), aftersaleNo: 'AS20260523001', orderId: BigInt(1), orderItemId: BigInt(10),
  userId: BigInt(100), type: 1, status: AftersaleStatus.approved, refundAmount: 9900,
  reason: '不想要了', order: { id: BigInt(1), status: OrderStatus.aftersale, completedAt: null },
  orderItem: ORDER_ITEM_WITH_DELIVERED_ORDER,
};

const RETURNED_AFTERSALE = {
  id: BigInt(50), aftersaleNo: 'AS20260523001', orderId: BigInt(1), orderItemId: BigInt(10),
  userId: BigInt(100), type: 2, status: AftersaleStatus.returned, refundAmount: 9900,
  reason: '质量问题', order: { id: BigInt(1), status: OrderStatus.aftersale, completedAt: null },
  orderItem: ORDER_ITEM_WITH_DELIVERED_ORDER,
};

const CREATE_DTO = { orderId: '1', orderItemId: '10', type: 1, reason: '不想要了' };

describe('AftersaleService.create 售后申请幂等', () => {
  let service: AftersaleService;
  let mockPrisma: any;

  beforeEach(() => {
    ({ service, mockPrisma } = createService());
  });

  it('正常申请售后成功，设置 activeOrderItemId', async () => {
    mockPrisma.orderItem.findFirst.mockResolvedValue(ORDER_ITEM_WITH_DELIVERED_ORDER);

    setupTransaction(mockPrisma);
    mockPrisma._mockTx.aftersaleOrder.create.mockResolvedValue({
      id: BigInt(50), aftersaleNo: 'AS20260523001', status: AftersaleStatus.pending_review,
    });
    mockPrisma._mockTx.order.update.mockResolvedValue({});

    const result = await service.create('100', CREATE_DTO);

    expect(mockPrisma._mockTx.aftersaleOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          activeOrderItemId: BigInt(10),
        }),
      }),
    );
    expect(mockPrisma._mockTx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: OrderStatus.aftersale }),
      }),
    );
  });

  it('并发申请售后：unique constraint P2002 拦截重复', async () => {
    mockPrisma.orderItem.findFirst.mockResolvedValue(ORDER_ITEM_WITH_DELIVERED_ORDER);

    const prismaError: any = new Error('Unique constraint failed');
    prismaError.code = 'P2002';
    mockPrisma.$transaction.mockRejectedValue(prismaError);

    await expect(service.create('100', CREATE_DTO))
      .rejects.toThrow('该商品已申请售后');
  });

  it('其他 Prisma 错误不被吞掉', async () => {
    mockPrisma.orderItem.findFirst.mockResolvedValue(ORDER_ITEM_WITH_DELIVERED_ORDER);

    const prismaError: any = new Error('Some other error');
    prismaError.code = 'P2003';
    mockPrisma.$transaction.mockRejectedValue(prismaError);

    await expect(service.create('100', CREATE_DTO))
      .rejects.toThrow('Some other error');
  });

  it('非 delivered/completed 订单不能申请售后', async () => {
    mockPrisma.orderItem.findFirst.mockResolvedValue({
      ...ORDER_ITEM_WITH_DELIVERED_ORDER,
      order: { id: BigInt(1), userId: BigInt(100), status: OrderStatus.pending_payment, completedAt: null },
    });

    await expect(service.create('100', CREATE_DTO))
      .rejects.toThrow('订单状态不允许申请售后');
  });
});

describe('AftersaleService.refund 退款发起幂等与状态一致性', () => {
  let service: AftersaleService;
  let mockPrisma: any;
  let mockPayment: any;

  beforeEach(() => {
    ({ service, mockPrisma, mockPayment } = createService());
  });

  it('仅退款类型：approved 状态可发起退款', async () => {
    mockPrisma.aftersaleOrder.findFirst
      .mockResolvedValueOnce(APPROVED_AFTERSALE)
      .mockResolvedValueOnce({ ...APPROVED_AFTERSALE, status: AftersaleStatus.pending_refund });
    mockPayment.createRefund.mockResolvedValue({
      refundId: '1', refundNo: 'REFUND001', outRefundNo: 'REFUND001',
    });

    const result = await service.refund('50', '1');

    expect(mockPayment.createRefund).toHaveBeenCalledWith(
      expect.objectContaining({ aftersaleId: '50', refundAmount: 9900 }),
    );
  });

  it('退货退款类型：returned 状态可发起退款', async () => {
    mockPrisma.aftersaleOrder.findFirst
      .mockResolvedValueOnce(RETURNED_AFTERSALE)
      .mockResolvedValueOnce({ ...RETURNED_AFTERSALE, status: AftersaleStatus.pending_refund });
    mockPayment.createRefund.mockResolvedValue({
      refundId: '1', refundNo: 'REFUND001', outRefundNo: 'REFUND001',
    });

    const result = await service.refund('50', '1');

    expect(mockPayment.createRefund).toHaveBeenCalled();
  });

  it('重复点击退款：pending_refund 状态直接拒绝', async () => {
    mockPrisma.aftersaleOrder.findFirst.mockResolvedValue({
      ...APPROVED_AFTERSALE, status: AftersaleStatus.pending_refund,
    });

    await expect(service.refund('50', '1'))
      .rejects.toThrow('退款已在处理中或已完成');

    expect(mockPayment.createRefund).not.toHaveBeenCalled();
  });

  it('重复点击退款：refunded 状态直接拒绝', async () => {
    mockPrisma.aftersaleOrder.findFirst.mockResolvedValue({
      ...APPROVED_AFTERSALE, status: AftersaleStatus.refunded,
    });

    await expect(service.refund('50', '1'))
      .rejects.toThrow('退款已在处理中或已完成');

    expect(mockPayment.createRefund).not.toHaveBeenCalled();
  });

  it('微信退款请求失败时售后单不卡死在 pending_refund', async () => {
    mockPrisma.aftersaleOrder.findFirst.mockResolvedValue(APPROVED_AFTERSALE);
    mockPayment.createRefund.mockRejectedValue(new BadRequestException('微信退款请求失败'));
    mockPrisma.aftersaleLog.create.mockResolvedValue({});

    await expect(service.refund('50', '1'))
      .rejects.toThrow('微信退款请求失败');

    expect(mockPrisma.aftersaleLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'refund_failed',
          aftersaleId: BigInt(50),
        }),
      }),
    );
  });

  it('createRefund 幂等：已有退款单时不重复创建', async () => {
    mockPrisma.aftersaleOrder.findFirst
      .mockResolvedValueOnce(APPROVED_AFTERSALE)
      .mockResolvedValueOnce({ ...APPROVED_AFTERSALE, status: AftersaleStatus.pending_refund });
    mockPayment.createRefund.mockResolvedValue({
      refundId: '1', refundNo: 'REFUND001', outRefundNo: 'REFUND001',
    });

    await service.refund('50', '1');

    expect(mockPayment.createRefund).toHaveBeenCalledTimes(1);
  });

  it('仅退款类型非 approved 状态不能退款', async () => {
    mockPrisma.aftersaleOrder.findFirst.mockResolvedValue({
      ...APPROVED_AFTERSALE, type: 1, status: AftersaleStatus.pending_review,
    });

    await expect(service.refund('50', '1'))
      .rejects.toThrow('仅退款类型需审核通过后才能退款');
  });

  it('退货退款类型非 returned 状态不能退款', async () => {
    mockPrisma.aftersaleOrder.findFirst.mockResolvedValue({
      ...RETURNED_AFTERSALE, type: 2, status: AftersaleStatus.approved,
    });

    await expect(service.refund('50', '1'))
      .rejects.toThrow('退货退款类型需用户填写退货物流后才能退款');
  });
});

describe('AftersaleService.approve 退款金额校验', () => {
  let service: AftersaleService;
  let mockPrisma: any;

  beforeEach(() => {
    ({ service, mockPrisma } = createService());
  });

  it('退款金额<=0时拒绝', async () => {
    mockPrisma.aftersaleOrder.findFirst.mockResolvedValue({
      ...APPROVED_AFTERSALE,
      status: AftersaleStatus.pending_review,
      orderItem: { ...ORDER_ITEM_WITH_DELIVERED_ORDER, subtotal: 1000 },
    });
    await expect(service.approve('50', '1', 0)).rejects.toThrow('退款金额必须大于0分');
  });

  it('退款金额超过可退金额时拒绝', async () => {
    mockPrisma.aftersaleOrder.findFirst.mockResolvedValue({
      ...APPROVED_AFTERSALE,
      status: AftersaleStatus.pending_review,
      orderItem: { ...ORDER_ITEM_WITH_DELIVERED_ORDER, subtotal: 1000 },
    });
    await expect(service.approve('50', '1', 1001)).rejects.toThrow('退款金额不能超过可退金额');
  });
});
