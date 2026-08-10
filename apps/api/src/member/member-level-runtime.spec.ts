import {
  calculateMemberDiscountAmount,
  calculateMemberRewardPoints,
  calculateOrderGrowthValue,
  resolveMemberLevel,
  type RuntimeMemberLevel,
} from './member-level-runtime';

const levels: RuntimeMemberLevel[] = [
  { id: 1n, name: '普通会员', minGrowthValue: 0, maxGrowthValue: 99, discountRate: 100, pointsRate: 10, sortOrder: 1, status: 1 },
  { id: 2n, name: '银卡会员', minGrowthValue: 100, maxGrowthValue: 999, discountRate: 90, pointsRate: 15, sortOrder: 2, status: 1 },
  { id: 3n, name: '金卡会员', minGrowthValue: 1000, maxGrowthValue: null, discountRate: 85, pointsRate: 20, sortOrder: 3, status: 1 },
];

describe('member-level-runtime', () => {
  it('按成长值解析当前有效等级', () => {
    expect(resolveMemberLevel(levels, 0)?.id).toBe(1n);
    expect(resolveMemberLevel(levels, 100)?.id).toBe(2n);
    expect(resolveMemberLevel(levels, 999)?.id).toBe(2n);
    expect(resolveMemberLevel(levels, 1000)?.id).toBe(3n);
  });

  it('9折会员价在100元订单上记录10元会员优惠', () => {
    expect(calculateMemberDiscountAmount(10000, 90)).toBe(1000);
    expect(calculateMemberDiscountAmount(10000, 100)).toBe(0);
    expect(calculateMemberDiscountAmount(10000, null)).toBe(0);
  });

  it('积分倍率只影响积分奖励，成长值始终按实付基础值累计', () => {
    expect(calculateOrderGrowthValue(2500)).toBe(25);
    expect(calculateMemberRewardPoints(2500, 15)).toBe(37);
    expect(calculateMemberRewardPoints(2500, 10)).toBe(25);
    expect(calculateMemberRewardPoints(2500, null)).toBe(25);
  });
});
