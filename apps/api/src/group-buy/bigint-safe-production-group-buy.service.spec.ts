import { describe, expect, it, jest } from '@jest/globals';
import { BigintSafeProductionGroupBuyService } from './bigint-safe-production-group-buy.service';

function createService() {
  const now = Date.now();
  const groupA = 9007199254740992n;
  const groupB = 9007199254740993n;
  const leaderA = 9100000000000001n;
  const leaderB = 9100000000000002n;
  const prisma = {
    groupBuyActivity: {
      findFirst: jest.fn<any>().mockResolvedValue({
        id: 8000000000000001n,
        status: 1,
        startTime: new Date(now - 60_000),
        endTime: new Date(now + 60_000),
      }),
    },
    groupBuyGroup: {
      findMany: jest.fn<any>().mockResolvedValue([
        { id: groupA, activityId: 8000000000000001n, leaderUserId: leaderA },
        { id: groupB, activityId: 8000000000000001n, leaderUserId: leaderB },
      ]),
    },
    groupBuyMember: {
      findMany: jest.fn<any>().mockResolvedValue([
        { id: 1n, groupId: groupA, userId: 101n, role: 'leader', status: 'paid', paidAt: new Date() },
        { id: 2n, groupId: groupB, userId: 202n, role: 'leader', status: 'paid', paidAt: new Date() },
      ]),
    },
    user: {
      findMany: jest.fn<any>().mockResolvedValue([
        { id: leaderA, nickname: '团长A', avatarUrl: 'a.jpg' },
        { id: leaderB, nickname: '团长B', avatarUrl: 'b.jpg' },
      ]),
    },
  };

  const service = new BigintSafeProductionGroupBuyService(
    prisma as any,
    {} as any,
    {} as any,
    {} as any,
  );
  return { service, groupA, groupB };
}

describe('BigintSafeProductionGroupBuyService', () => {
  it('超过 JS 安全整数的相邻团 ID 不会串成员', async () => {
    const { service, groupA, groupB } = createService();
    expect(Number(groupA)).toBe(Number(groupB));

    const result = await service.weappFindAvailableGroups('8000000000000001');

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(groupA);
    expect(result[0].members.map((member: any) => member.userId)).toEqual([101n]);
    expect(result[0].leader?.nickname).toBe('团长A');
    expect(result[1].id).toBe(groupB);
    expect(result[1].members.map((member: any) => member.userId)).toEqual([202n]);
    expect(result[1].leader?.nickname).toBe('团长B');
  });
});
