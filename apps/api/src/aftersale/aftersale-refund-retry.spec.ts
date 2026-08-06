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

function createService(latestRefundStatus: string | null) {
  const prisma = {
    aftersaleOrder: {
      findFirst: jest.fn().mockResolvedValue(PENDING_REFUND_AFTERSALE),
    },
    orderRefund: {
      findFirst: jest.fn().mockResolvedValue(
        latestRefundStatus ? { id: 70n, status: latestRefundStatus, createdAt: new Date() } : null,
      ),
    },
    aftersaleLog: { create: jest.fn() },
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
  for (const terminalStatus of [REFUND_STATUS.FAILED, REFUND_STATUS.CLOSED, REFUND_STATUS.ABNORMAL]) {
    it(`最近退款为 ${terminalStatus} 时允许重新发起`, async () => {
      const { service, prisma, paymentService } = createService(terminalStatus);

      await service.refund('50', '1');

      expect(prisma.orderRefund.findFirst).toHaveBeenCalledWith({
        where: { aftersaleId: 50n },
        orderBy: { createdAt: 'desc' },
      });
      expect(paymentService.createRefund).toHaveBeenCalledWith({
        orderId: '1',
        aftersaleId: '50',
        refundAmount: 9900,
        reason: '退款失败后重试',
      });
    });
  }

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
});
