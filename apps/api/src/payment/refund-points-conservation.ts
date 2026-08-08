export interface RefundPointTargets {
  cumulativeRefundAmount: number;
  restoreDeductedTarget: number;
  clawbackRewardTarget: number;
}

function assertNonNegativeSafeInteger(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
}

/**
 * Calculate targets from cumulative successful refunds, never from each refund independently.
 * This makes rounding deterministic: when cumulativeRefundAmount reaches payAmount, both targets
 * equal the original point totals exactly, so N partial refunds cannot strand rounding dust.
 */
export function calculateRefundPointTargets(params: {
  payAmount: number;
  cumulativeRefundAmount: number;
  originalDeductedPoints: number;
  originalRewardPoints: number;
}): RefundPointTargets {
  const {
    payAmount,
    cumulativeRefundAmount,
    originalDeductedPoints,
    originalRewardPoints,
  } = params;
  if (!Number.isSafeInteger(payAmount) || payAmount <= 0) {
    throw new Error('payAmount must be a positive safe integer');
  }
  assertNonNegativeSafeInteger(cumulativeRefundAmount, 'cumulativeRefundAmount');
  assertNonNegativeSafeInteger(originalDeductedPoints, 'originalDeductedPoints');
  assertNonNegativeSafeInteger(originalRewardPoints, 'originalRewardPoints');

  const cappedRefundAmount = Math.min(payAmount, cumulativeRefundAmount);
  const target = (points: number) => cappedRefundAmount >= payAmount
    ? points
    : Math.floor(points * cappedRefundAmount / payAmount);

  return {
    cumulativeRefundAmount: cappedRefundAmount,
    restoreDeductedTarget: target(originalDeductedPoints),
    clawbackRewardTarget: target(originalRewardPoints),
  };
}
