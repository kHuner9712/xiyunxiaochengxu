export interface RuntimeMemberLevel {
  id: bigint;
  name: string;
  minGrowthValue: number;
  maxGrowthValue: number | null;
  discountRate: number | null;
  pointsRate: number;
  sortOrder: number;
  status: number;
}

export function resolveMemberLevelIndex(
  levels: RuntimeMemberLevel[],
  growthValue: number,
): number {
  if (levels.length === 0) return -1;

  let matched = -1;
  for (let index = 0; index < levels.length; index += 1) {
    const level = levels[index];
    if (
      growthValue >= level.minGrowthValue &&
      (level.maxGrowthValue === null || growthValue <= level.maxGrowthValue)
    ) {
      matched = index;
    }
  }
  if (matched >= 0) return matched;
  if (growthValue < levels[0].minGrowthValue) return 0;
  return levels.length - 1;
}

export function resolveMemberLevel(
  levels: RuntimeMemberLevel[],
  growthValue: number,
): RuntimeMemberLevel | null {
  const index = resolveMemberLevelIndex(levels, growthValue);
  return index >= 0 ? levels[index] : null;
}

export async function loadActiveMemberLevels(client: any): Promise<RuntimeMemberLevel[]> {
  if (!client?.memberLevel?.findMany) return [];
  return client.memberLevel.findMany({
    where: { status: 1 },
    orderBy: [{ minGrowthValue: 'asc' }, { sortOrder: 'asc' }],
  });
}

export async function reconcileMemberLevelForGrowth(
  client: any,
  params: {
    userId: bigint;
    currentMemberLevelId: bigint | null | undefined;
    growthValue: number;
    reason: string;
    levels?: RuntimeMemberLevel[];
  },
): Promise<RuntimeMemberLevel | null> {
  const levels = params.levels ?? await loadActiveMemberLevels(client);
  const target = resolveMemberLevel(levels, params.growthValue);
  if (!target || target.id === params.currentMemberLevelId) return target;

  await client.user.update({
    where: { id: params.userId },
    data: { memberLevelId: target.id },
  });
  if (client?.userMemberRecord?.create) {
    await client.userMemberRecord.create({
      data: {
        userId: params.userId,
        oldLevelId: params.currentMemberLevelId ?? null,
        newLevelId: target.id,
        changeReason: params.reason.slice(0, 200),
      },
    });
  }
  return target;
}

export function calculateMemberDiscountAmount(
  totalAmount: number,
  discountRate: number | null | undefined,
): number {
  if (!Number.isSafeInteger(totalAmount) || totalAmount < 0) {
    throw new Error('totalAmount must be a non-negative safe integer');
  }
  if (discountRate === null || discountRate === undefined || discountRate >= 100) return 0;
  if (!Number.isSafeInteger(discountRate) || discountRate < 1 || discountRate > 100) {
    throw new Error('discountRate must be an integer between 1 and 100');
  }
  const memberPrice = Math.floor(totalAmount * discountRate / 100);
  return Math.max(0, totalAmount - memberPrice);
}

export function calculateMemberRewardPoints(
  payAmount: number,
  pointsRate: number | null | undefined,
): number {
  if (!Number.isSafeInteger(payAmount) || payAmount < 0) {
    throw new Error('payAmount must be a non-negative safe integer');
  }
  const basePoints = Math.floor(payAmount / 100);
  if (basePoints <= 0) return 0;
  const normalizedRate = Number.isSafeInteger(pointsRate) && (pointsRate as number) > 0
    ? (pointsRate as number)
    : 10;
  return Math.max(0, Math.floor(basePoints * normalizedRate / 10));
}
