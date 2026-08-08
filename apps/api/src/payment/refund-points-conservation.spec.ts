import { calculateRefundPointTargets } from './refund-points-conservation';

describe('calculateRefundPointTargets', () => {
  it('eliminates rounding dust across three partial refunds', () => {
    const first = calculateRefundPointTargets({
      payAmount: 333,
      cumulativeRefundAmount: 111,
      originalDeductedPoints: 100,
      originalRewardPoints: 10,
    });
    const second = calculateRefundPointTargets({
      payAmount: 333,
      cumulativeRefundAmount: 222,
      originalDeductedPoints: 100,
      originalRewardPoints: 10,
    });
    const final = calculateRefundPointTargets({
      payAmount: 333,
      cumulativeRefundAmount: 333,
      originalDeductedPoints: 100,
      originalRewardPoints: 10,
    });

    expect(first.restoreDeductedTarget).toBe(33);
    expect(second.restoreDeductedTarget).toBe(66);
    expect(final.restoreDeductedTarget).toBe(100);
    expect(final.restoreDeductedTarget - second.restoreDeductedTarget).toBe(34);

    expect(first.clawbackRewardTarget).toBe(3);
    expect(second.clawbackRewardTarget).toBe(6);
    expect(final.clawbackRewardTarget).toBe(10);
    expect(final.clawbackRewardTarget - second.clawbackRewardTarget).toBe(4);
  });

  it('caps over-reported cumulative refunds at the paid amount', () => {
    const target = calculateRefundPointTargets({
      payAmount: 1000,
      cumulativeRefundAmount: 1200,
      originalDeductedPoints: 600,
      originalRewardPoints: 20,
    });

    expect(target).toEqual({
      cumulativeRefundAmount: 1000,
      restoreDeductedTarget: 600,
      clawbackRewardTarget: 20,
    });
  });

  it('keeps partial targets below the original point totals', () => {
    const target = calculateRefundPointTargets({
      payAmount: 10000,
      cumulativeRefundAmount: 2500,
      originalDeductedPoints: 800,
      originalRewardPoints: 100,
    });

    expect(target.restoreDeductedTarget).toBe(200);
    expect(target.clawbackRewardTarget).toBe(25);
  });
});
