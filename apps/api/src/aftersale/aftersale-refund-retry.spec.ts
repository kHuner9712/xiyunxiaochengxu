import { describe, expect, it, jest } from '@jest/globals';
import { AftersaleStatus, OrderStatus } from '@prisma/client';
import { REFUND_STATUS } from '../common/constants';
import { AftersaleService } from './aftersale.service';

const PENDING_REFUND_AFTERSALE = {
  id: 50n,
  aftersaleNo: 'AS202608070001',
  orderId: 1n,
  orderItemId: 10n,
  userId: 100n,
  adminId: 1n,
  type: 1,
  status: AftersaleStatus.pending_refund,
  refundAmount: 9900,
  reason: '退款失败后重试',
  order: { id: 1n, userId: 100n, status: OrderStatus.aftersale, completedAt: null },
  orderItem: {
    id: 10n,
    orderId: 1n,
    productId: 20n,
    skuId: 30n,
    quantity: 1,
    subtotal: 9900,
  },
};

const APPROVED_AFTERSALE = {
  ...PENDING_REFUND_AFTERSALE,
  status: AftersaleStatus.approved,
};

function refundRecord(status: string, id = 70n) {
  return { id, status, outRefundNo: `RF${id}`, createdAt: new Date() };
}

function createService(
  latestRefundStatus: string | null,
  options: {
    aftersale?: any;
    refundSequence?: any[];
    aftersaleClaimCounts?: number[];
    refundClaimCounts?: number[];
  } = {},
) {
  const findRefund = jest.fn();
  if (options.refundSequence) {
    for (const value of options.refundSequence) findRefund.mockResolvedValueOnce(value);
  } else {
    findRefund.mockResolvedValue(
      latestRefundStatus ? refundRecord(latestRefundStatus) : null,
    );
  }

  const aftersaleUpdateMany = jest.fn();
  for (const count of options.aftersaleClaimCounts || [1]) {
    aftersaleUpdateMany.mockResolvedValueOnce({ count });
  }
  aftersaleUpdateMany.mockResolvedValue({ count: 1 });

  const refundUpdateMany = jest.fn();
  for (const count of options.refundClaimCounts || [1, 1]) {
    refundUpdateMany.mockResolvedValueOnce({ count });
  }
  refundUpdateMany.mockResolvedValue({ count: 1 });

  const prisma = {
    aftersaleOrder: {
      findFirst: jest.fn().mockResolvedValue(options.aftersale || PENDING_REFUND_AFTERSALE),
      updateMany: aftersaleUpdateMany,
    },
    orderRefund: {
      findFirst: findRefund,
      updateMany: refundUpdateMany,
    },
    aftersaleLog: { create: jest.fn().mockResolvedValue({}) },
  };
  const paymentService = {
    createRefund: jest.fn().mockResolvedValue({
      refundId: '71',
      refundNo: 'RF202608070001',
      outRefundNo: 'RF202608070001',
    }),
  };
  const service = new AftersaleService(prisma as any, paymentService as any);
  jest.spyOn(service['logger'], 'log').mockImplementation(() => {});
  jest.spyOn(service['logger'], 'warn').mockImplementation(() => {});
  jest.spyOn(service['logger'], 'error').mockImplementation(() => {});
  return { service, prisma, paymentService };
}

describe('AftersaleService refund retry', () => {
  for (const terminalStatus of [REFUND_STATUS.CLOSED, REFUND_STATUS.ABNORMAL]) {
    it(`最近退款为 ${terminalStatus} 时原子占位后重新发起并恢复历史终态`, async () => {
      const { service, prisma, paymentService } = createService(terminalStatus);

      await service.refund('50', '1');

      expect(prisma.orderRefund.updateMany).toHaveBeenNthCalledWith(1, {
        where: { id: 70n, status: terminalStatus },
        data: { status: REFUND_STATUS.FAILED },
      });
      expect(paymentService.createRefund).toHaveBeenCalledWith({
        orderId: '1',
        aftersaleId: '50',
        refundAmount: 9900,
        reason: '退款失败后重试',
      });
      expect(prisma.orderRefund.updateMany).toHaveBeenNthCalledWith(2, {
        where: { id: 70n, status: REFUND_STATUS.FAILED },
        data: { status: terminalStatus },
      });
    });
  }

  it('最近退款为 failed 时必须先同步微信状态', async () => {
    const { service, paymentService } = createService(REFUND_STATUS.FAILED);

    await expect(service.refund('50', '1'))
      .rejects.toThrow('退款请求结果待核实，请先同步微信退款状态');
    expect(paymentService.createRefund).not.toHaveBeenCalled();
  });

  for (const activeStatus of [REFUND_STATUS.INITIATING, REFUND_STATUS.PENDING, REFUND_STATUS.PROCESSING, REFUND_STATUS.SUCCESS]) {
    it(`最近退款为 ${activeStatus} 时拒绝重复发起`, async () => {
      const { service, paymentService } = createService(activeStatus);

      await expect(service.refund('50', '1')).rejects.toThrow('退款已在处理中或已完成');
      expect(paymentService.createRefund).not.toHaveBeenCalled();
    });
  }

  it('pending_refund 但没有退款记录时拒绝盲目重试', async () => {
    const { service, paymentService } = createService(null);

    await expect(service.refund('50', '1')).rejects.toThrow('退款已在处理中或已完成');
    expect(paymentService.createRefund).not.toHaveBeenCalled();
  });

  it('后台详情只对微信确认 closed/abnormal 返回重试标志', async () => {
    const { service, prisma } = createService(REFUND_STATUS.CLOSED);

    await expect(service.findAdminDetail('50')).resolves.toEqual(
      expect.objectContaining({
        latestRefundStatus: REFUND_STATUS.CLOSED,
        latestOutRefundNo: 'RF70',
        refundRetryable: true,
      }),
    );
    expect(prisma.orderRefund.findFirst).toHaveBeenCalledWith({
      where: { aftersaleId: 50n },
      orderBy: { createdAt: 'desc' },
      select: { status: true, outRefundNo: true },
    });
  });

  it('后台详情对 failed 只提示同步，不开放重试', async () => {
    const { service } = createService(REFUND_STATUS.FAILED);

    await expect(service.findAdminDetail('50')).resolves.toEqual(
      expect.objectContaining({
        latestRefundStatus: REFUND_STATUS.FAILED,
        refundRetryable: false,
      }),
    );
  });
});

describe('AftersaleService atomic refund initiation claim', () => {
  it('首次退款先将售后状态原子切换为 pending_refund 再调用支付服务', async () => {
    const { service, prisma, paymentService } = createService(null, {
      aftersale: APPROVED_AFTERSALE,
    });

    await service.refund('50', '1');

    expect(prisma.aftersaleOrder.updateMany).toHaveBeenCalledWith({
      where: { id: 50n, status: AftersaleStatus.approved },
      data: { status: AftersaleStatus.pending_refund },
    });
    expect(paymentService.createRefund).toHaveBeenCalledTimes(1);
  });

  it('首次退款占位失败时拒绝重复提交且不调用支付服务', async () => {
    const { service, prisma, paymentService } = createService(null, {
      aftersale: APPROVED_AFTERSALE,
      aftersaleClaimCounts: [0],
    });

    await expect(service.refund('50', '1'))
      .rejects.toThrow('退款操作正在处理中，请勿重复提交');

    expect(paymentService.createRefund).not.toHaveBeenCalled();
    expect(prisma.aftersaleLog.create).not.toHaveBeenCalled();
  });

  it('失败终态重试占位失败时拒绝重复提交且不调用支付服务', async () => {
    const { service, prisma, paymentService } = createService(REFUND_STATUS.CLOSED, {
      refundClaimCounts: [0],
    });

    await expect(service.refund('50', '1'))
      .rejects.toThrow('退款操作正在处理中，请勿重复提交');

    expect(paymentService.createRefund).not.toHaveBeenCalled();
    expect(prisma.aftersaleLog.create).not.toHaveBeenCalled();
  });

  it('网络错误但已生成新退款记录时保留 pending_refund 并要求同步', async () => {
    const newFailedRefund = refundRecord(REFUND_STATUS.FAILED, 71n);
    const { service, prisma, paymentService } = createService(null, {
      aftersale: APPROVED_AFTERSALE,
      refundSequence: [null, newFailedRefund],
    });
    paymentService.createRefund.mockRejectedValue(new Error('socket timeout'));

    await expect(service.refund('50', '1')).rejects.toThrow('socket timeout');

    expect(prisma.aftersaleOrder.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.aftersaleLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'refund_failed',
          content: expect.stringContaining('请先同步微信退款状态'),
        }),
      }),
    );
  });

  it('支付服务在创建退款记录前失败时恢复原售后状态', async () => {
    const { service, prisma, paymentService } = createService(null, {
      aftersale: APPROVED_AFTERSALE,
      refundSequence: [null, null],
      aftersaleClaimCounts: [1, 1],
    });
    paymentService.createRefund.mockRejectedValue(new Error('支付配置缺失'));

    await expect(service.refund('50', '1')).rejects.toThrow('支付配置缺失');

    expect(prisma.aftersaleOrder.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: 50n, status: AftersaleStatus.pending_refund },
      data: { status: AftersaleStatus.approved },
    });
    expect(prisma.aftersaleLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          content: expect.stringContaining('售后单已恢复原状态'),
        }),
      }),
    );
  });

  it('失败终态重试异常时仍恢复上一笔退款的真实终态', async () => {
    const oldClosed = refundRecord(REFUND_STATUS.CLOSED, 70n);
    const claimedOld = refundRecord(REFUND_STATUS.FAILED, 70n);
    const { service, prisma, paymentService } = createService(null, {
      refundSequence: [oldClosed, claimedOld],
      refundClaimCounts: [1, 1],
    });
    paymentService.createRefund.mockRejectedValue(new Error('支付配置缺失'));

    await expect(service.refund('50', '1')).rejects.toThrow('支付配置缺失');

    expect(prisma.orderRefund.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: 70n, status: REFUND_STATUS.FAILED },
      data: { status: REFUND_STATUS.CLOSED },
    });
  });
});
