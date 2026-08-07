import { describe, expect, it, jest } from '@jest/globals';
import { CancellationSafeStockSafePaymentService } from './cancellation-safe-stock-safe-payment.service';
import { NetRewardSafePaymentService } from './net-reward-safe-payment.service';

function createService(params?: {
  payAmount?: number;
  completionReward?: number | null;
  totalRefundedAfter?: number;
  baseDeduction?: number;
  availablePoints?: number;
  existingAdjustment?: boolean;
}) {
  const payAmount = params?.payAmount ?? 10000;
  const completionReward = params?.completionReward === undefined ? 90 : params.completionReward;
  const totalRefundedAfter = params?.totalRefundedAfter ?? 2000;
  const baseDeduction = params?.baseDeduction ?? 9;
  const availablePoints = params?.availablePoints ?? 100;
  const existingAdjustment = params?.existingAdjustment ?? false;

  const pointsFindFirst = jest.fn()
    .mockResolvedValueOnce(existingAdjustment ? { id: 999n } : null)
    .mockResolvedValueOnce(completionReward === null ? null : { points: completionReward });
  const pointsFindMany = (jest.fn() as any).mockResolvedValue(
    baseDeduction > 0 ? [{ points: baseDeduction }] : [],
  );
  const pointsCreate = jest.fn();
  const userUpdate = jest.fn();
  const tx = {
    pointsRecord: {
      findFirst: pointsFindFirst,
      findMany: pointsFindMany,
      create: pointsCreate,
    },
    order: {
      findUnique: (jest.fn() as any).mockResolvedValue({
        id: 100n,
        userId: 1000n,
        payAmount,
      }),
    },
    orderRefund: {
      aggregate: (jest.fn() as any).mockResolvedValue({
        _sum: { refundAmount: totalRefundedAfter },
      }),
    },
    user: {
      findUnique: (jest.fn() as any).mockResolvedValue({ availablePoints }),
      update: userUpdate,
    },
  };
  const prisma = {
    $transaction: jest.fn(async (callback: any) => callback(tx)),
  };
  const config = { get: jest.fn(() => '') };
  const businessEvent = {
    emit: jest.fn(),
    emitInfo: jest.fn(),
    emitWarn: jest.fn(),
    emitError: jest.fn(),
    emitCritical: jest.fn(),
  };
  const orderService = {};
  const shareService = {};
  const benefitService = {};
  const settlementService = {};
  const groupBuyService = {};
  const flashSaleService = {};
  const redis = {};
  const service = new NetRewardSafePaymentService(
    prisma as any,
    config as any,
    businessEvent as any,
    orderService as any,
    shareService as any,
    benefitService as any,
    settlementService as any,
    groupBuyService as any,
    flashSaleService as any,
    redis as any,
  );
  const parentSpy = jest
    .spyOn(CancellationSafeStockSafePaymentService.prototype, 'processWechatRefundSuccess')
    .mockResolvedValue(undefined);

  return {
    service,
    parentSpy,
    businessEvent,
    pointsCreate,
    userUpdate,
    pointsFindMany,
  };
}

const REFUND = {
  id: 200n,
  orderId: 100n,
  aftersaleId: 300n,
  refundAmount: 1000,
};

describe('NetRewardSafePaymentService refund reward calibration', () => {
  it('adds the missing marginal deduction after a prior pre-completion refund', async () => {
    const fixture = createService({
      payAmount: 10000,
      completionReward: 90,
      totalRefundedAfter: 2000,
      baseDeduction: 9,
      availablePoints: 100,
    });

    await fixture.service.processWechatRefundSuccess(REFUND, 'WX_REFUND', {});

    expect(fixture.parentSpy).toHaveBeenCalled();
    expect(fixture.userUpdate).toHaveBeenCalledWith({
      where: { id: 1000n },
      data: { availablePoints: { decrement: 1 } },
    });
    expect(fixture.pointsCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: 2,
        points: 1,
        source: 'refund_reward_net_deduct',
        sourceId: 200n,
      }),
    }));
  });

  it('does nothing when the base refund deduction already matches the exact marginal net reward', async () => {
    const fixture = createService({ baseDeduction: 10 });

    await fixture.service.processWechatRefundSuccess(REFUND, 'WX_REFUND', {});

    expect(fixture.userUpdate).not.toHaveBeenCalled();
    expect(fixture.pointsCreate).not.toHaveBeenCalled();
  });

  it('restores points when the base proportional formula deducted more than the exact marginal amount', async () => {
    const fixture = createService({ baseDeduction: 12, availablePoints: 50 });

    await fixture.service.processWechatRefundSuccess(REFUND, 'WX_REFUND', {});

    expect(fixture.userUpdate).toHaveBeenCalledWith({
      where: { id: 1000n },
      data: { availablePoints: { increment: 2 } },
    });
    expect(fixture.pointsCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: 1,
        points: 2,
        balance: 52,
        source: 'refund_reward_net_restore',
        sourceId: 200n,
      }),
    }));
  });

  it('deducts only available points and records an operational warning when the remaining reward cannot be recovered', async () => {
    const fixture = createService({ baseDeduction: 0, availablePoints: 4 });

    await fixture.service.processWechatRefundSuccess(REFUND, 'WX_REFUND', {});

    expect(fixture.userUpdate).toHaveBeenCalledWith({
      where: { id: 1000n },
      data: { availablePoints: { decrement: 4 } },
    });
    expect(fixture.pointsCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        points: 4,
        source: 'refund_reward_net_deduct_partial',
        sourceId: 200n,
      }),
    }));
    expect(fixture.businessEvent.emitWarn).toHaveBeenCalledWith(
      'refund_reward_net_points_insufficient',
      'refund',
      expect.any(String),
      '200',
      expect.objectContaining({
        requiredDeductedPoints: 10,
        actualDeductedPoints: 4,
        remainingDebtPoints: 6,
      }),
    );
  });

  it('is idempotent when this refund already has a net reward adjustment record', async () => {
    const fixture = createService({ existingAdjustment: true });

    await fixture.service.processWechatRefundSuccess(REFUND, 'WX_REFUND', {});

    expect(fixture.pointsFindMany).not.toHaveBeenCalled();
    expect(fixture.userUpdate).not.toHaveBeenCalled();
    expect(fixture.pointsCreate).not.toHaveBeenCalled();
  });

  it('does not calibrate refund reward points when the order never earned completion reward points', async () => {
    const fixture = createService({ completionReward: null });

    await fixture.service.processWechatRefundSuccess(REFUND, 'WX_REFUND', {});

    expect(fixture.pointsFindMany).not.toHaveBeenCalled();
    expect(fixture.userUpdate).not.toHaveBeenCalled();
    expect(fixture.pointsCreate).not.toHaveBeenCalled();
  });
});
