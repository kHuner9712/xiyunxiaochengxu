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

function cumulativeTarget(points: number, refundedAmount: number, paidAmount: number) {
  if (points <= 0 || refundedAmount <= 0 || paidAmount <= 0) return 0;
  const cappedRefundAmount = Math.min(paidAmount, refundedAmount);
  return cappedRefundAmount >= paidAmount
    ? points
    : Math.floor(points * cappedRefundAmount / paidAmount);
}

/**
 * Calculate cumulative successful-refund targets, never per-refund deltas.
 *
 * Checkout-deducted points and completion-reward points intentionally use different refund bases:
 * - deducted points are restored against all successful cash refunds over the original pay amount;
 * - completion rewards are clawed back only against refunds that happened after completion, over the
 *   net cash amount that actually earned that reward. A refund already successful before completion
 *   was excluded when the reward was granted and must not be counted a second time.
 *
 * The optional reward-specific amounts default to the legacy order-level values for callers that do
 * not need the completion-time distinction.
 */
export function calculateRefundPointTargets(params: {
  payAmount: number;
  cumulativeRefundAmount: number;
  originalDeductedPoints: number;
  originalRewardPoints: number;
  rewardPayAmount?: number;
  rewardRefundAmount?: number;
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

  const rewardPayAmount = params.rewardPayAmount ?? payAmount;
  const rewardRefundAmount = params.rewardRefundAmount ?? cumulativeRefundAmount;
  assertNonNegativeSafeInteger(rewardPayAmount, 'rewardPayAmount');
  assertNonNegativeSafeInteger(rewardRefundAmount, 'rewardRefundAmount');

  const cappedRefundAmount = Math.min(payAmount, cumulativeRefundAmount);

  return {
    cumulativeRefundAmount: cappedRefundAmount,
    restoreDeductedTarget: cumulativeTarget(
      originalDeductedPoints,
      cappedRefundAmount,
      payAmount,
    ),
    clawbackRewardTarget: cumulativeTarget(
      originalRewardPoints,
      rewardRefundAmount,
      rewardPayAmount,
    ),
  };
}
