import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';
import { REFUND_STATUS } from '../common/constants';
import { CancellationSafeProductionOrderService } from './cancellation-safe-production-order.service';

function createService(prisma: any = {}) {
  const businessEvent = {
    emit: jest.fn(),
    emitInfo: jest.fn(),
    emitWarn: jest.fn(),
    emitError: jest.fn(),
    emitCritical: jest.fn(),
  };
  const benefitPackageService = { grantBenefitsForOrder: jest.fn() };
  const groupBuyService = { handlePaymentSuccess: jest.fn(), handleOrderCancel: jest.fn() };
  const flashSaleService = { handlePaymentSuccess: jest.fn(), handleOrderCancel: jest.fn() };
  const redis = { setNX: jest.fn(), releaseLockWithLua: jest.fn() };

  return new CancellationSafeProductionOrderService(
    prisma as any,
    businessEvent as any,
    benefitPackageService as any,
    groupBuyService as any,
    flashSaleService as any,
    redis as any,
  );
}

function createRewardTx(successfulRefundAmount: number) {
  const userUpdate = jest.fn();
  const pointsCreate = jest.fn();
  const refundAggregate = (jest.fn() as any).mockResolvedValue({
    _sum: { refundAmount: successfulRefundAmount },
  });
  const tx = {
    orderRefund: { aggregate: refundAggregate },
    pointsRecord: {
      findFirst: (jest.fn() as any).mockResolvedValue(null),
      create: pointsCreate,
    },
    user: {
      findFirst: (jest.fn() as any).mockResolvedValue({
        id: 100n,
        availablePoints: 500,
      }),
      update: userUpdate,
    },
  };
  return { tx, refundAggregate, userUpdate, pointsCreate };
}

describe('CancellationSafeProductionOrderService net-paid completion rewards', () => {
  const order = { id: 1n, userId: 100n, payAmount: 9900 };

  it('keeps the original completion reward when there were no successful refunds', async () => {
    const service = createService();
    const { tx, refundAggregate, pointsCreate } = createRewardTx(0);

    const earned = await (service as any).rewardCompletedOrder(tx, order, 'order_complete');

    expect(refundAggregate).toHaveBeenCalledWith({
      where: { orderId: 1n, status: REFUND_STATUS.SUCCESS },
      _sum: { refundAmount: true },
    });
    expect(earned).toBe(99);
    expect(pointsCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ points: 99, source: 'order_complete', sourceId: 1n }),
    }));
  });

  it('awards completion points from net paid amount after a successful pre-completion refund', async () => {
    const service = createService();
    const { tx, userUpdate, pointsCreate } = createRewardTx(900);

    const earned = await (service as any).rewardCompletedOrder(tx, order, 'order_complete');

    expect(earned).toBe(90);
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: 100n },
      data: {
        availablePoints: { increment: 90 },
        totalPoints: { increment: 90 },
        growthValue: { increment: 90 },
      },
    });
    expect(pointsCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ points: 90, balance: 590 }),
    }));
  });

  it('does not award purchase reward points after the order has already been fully refunded', async () => {
    const service = createService();
    const { tx, userUpdate, pointsCreate } = createRewardTx(9900);

    const earned = await (service as any).rewardCompletedOrder(tx, order, 'order_auto_complete');

    expect(earned).toBe(0);
    expect(userUpdate).not.toHaveBeenCalled();
    expect(pointsCreate).not.toHaveBeenCalled();
  });
});

describe('CancellationSafeProductionOrderService automatic completion observability', () => {
  const candidate = {
    id: 77n,
    userId: 100n,
    orderNo: 'AUTO-COMPLETE-77',
    status: 'delivered',
    payAmount: 9900,
    autoCompleteAt: new Date('2026-08-01T00:00:00Z'),
    orderItems: [],
  };

  it('logs real transactional failures instead of silently swallowing them', async () => {
    const prisma = {
      order: {
        findMany: (jest.fn() as any).mockResolvedValue([candidate]),
      },
    };
    const service = createService(prisma);
    const complete = (jest.fn() as any).mockRejectedValue(new Error('database write failed'));
    (service as any).completeOrderAndReward = complete;
    const logError = jest.spyOn((service as any).cancellationLogger, 'error').mockImplementation(() => undefined);

    const result = await service.autoCompleteOrders();

    expect(result).toEqual({ completedCount: 0 });
    expect(complete).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining('orderId=77'),
      expect.any(String),
    );
  });

  it('treats a concurrent claim loss as a normal skip without false error noise', async () => {
    const prisma = {
      order: {
        findMany: (jest.fn() as any).mockResolvedValue([candidate]),
      },
    };
    const service = createService(prisma);
    (service as any).completeOrderAndReward = (jest.fn() as any).mockRejectedValue(
      new BadRequestException('订单抢占失败'),
    );
    const logError = jest.spyOn((service as any).cancellationLogger, 'error').mockImplementation(() => undefined);

    const result = await service.autoCompleteOrders();

    expect(result).toEqual({ completedCount: 0 });
    expect(logError).not.toHaveBeenCalled();
  });
});
