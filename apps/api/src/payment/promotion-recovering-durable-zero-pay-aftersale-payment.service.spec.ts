import { jest } from '@jest/globals';
import { PromotionRecoveringDurableZeroPayAftersalePaymentService } from './promotion-recovering-durable-zero-pay-aftersale-payment.service';

function createRecoveryService(candidates: any[], outcomes: any[]) {
  const prisma = {
    $queryRaw: (jest.fn() as any).mockResolvedValue(candidates),
  };
  const groupBuyService = {
    handlePaymentSuccess: jest.fn<any>(),
  };
  for (const outcome of outcomes) {
    groupBuyService.handlePaymentSuccess.mockResolvedValueOnce(outcome);
  }

  const service: any = Object.create(
    PromotionRecoveringDurableZeroPayAftersalePaymentService.prototype,
  );
  service.promotionRecoveryPrisma = prisma;
  service.promotionRecoveryGroupBuyService = groupBuyService;
  service.promotionRecoveryLogger = {
    warn: jest.fn(),
    error: jest.fn(),
  };
  service.createGroupBuyFailureRefund = jest.fn<any>().mockResolvedValue({ status: 'pending' });

  return { service, prisma, groupBuyService };
}

describe('PromotionRecoveringDurableZeroPayAftersalePaymentService', () => {
  it('自动重放已支付但拼团成员仍未结算的订单', async () => {
    const candidates = [{
      orderId: 1001n,
      orderNo: 'G202608100001',
      memberStatus: 'pending_payment',
      groupStatus: 'forming',
    }];
    const { service, groupBuyService } = createRecoveryService(candidates, [
      { isGroupBuy: true, state: 'waiting' },
    ]);

    const result = await service.reconcileGroupBuyPaymentStateGaps(200);

    expect(groupBuyService.handlePaymentSuccess).toHaveBeenCalledWith(1001n);
    expect(service.createGroupBuyFailureRefund).not.toHaveBeenCalled();
    expect(result).toEqual({
      total: 1,
      recovered: 1,
      waiting: 1,
      releasedOrders: 0,
      refundRequired: 0,
      failed: 0,
    });
  });

  it('团已失败但支付事实成功时自动进入既有退款链', async () => {
    const candidates = [{
      orderId: 1002n,
      orderNo: 'G202608100002',
      memberStatus: 'paid',
      groupStatus: 'failed',
    }];
    const { service } = createRecoveryService(candidates, [
      {
        isGroupBuy: true,
        state: 'refund_required',
        reason: '拼团失败自动退款',
      },
    ]);

    const result = await service.reconcileGroupBuyPaymentStateGaps(200);

    expect(service.createGroupBuyFailureRefund).toHaveBeenCalledWith(
      1002n,
      '拼团失败自动退款',
    );
    expect(result.refundRequired).toBe(1);
    expect(result.failed).toBe(0);
  });

  it('单条补偿失败不会阻断后续异常订单继续收敛', async () => {
    const candidates = [
      {
        orderId: 1003n,
        orderNo: 'G202608100003',
        memberStatus: 'pending_payment',
        groupStatus: 'forming',
      },
      {
        orderId: 1004n,
        orderNo: 'G202608100004',
        memberStatus: 'paid',
        groupStatus: 'success',
      },
    ];
    const { service, groupBuyService } = createRecoveryService(candidates, []);
    groupBuyService.handlePaymentSuccess
      .mockRejectedValueOnce(new Error('temporary mysql failure'))
      .mockResolvedValueOnce({
        isGroupBuy: true,
        state: 'success',
        releasedOrderIds: ['1004'],
      });

    const result = await service.reconcileGroupBuyPaymentStateGaps(200);

    expect(groupBuyService.handlePaymentSuccess).toHaveBeenCalledTimes(2);
    expect(result.failed).toBe(1);
    expect(result.recovered).toBe(1);
    expect(result.releasedOrders).toBe(1);
  });
});
