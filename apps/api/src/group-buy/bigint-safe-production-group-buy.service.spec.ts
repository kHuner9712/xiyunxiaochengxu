import { describe, expect, it, jest } from '@jest/globals';
import { BigintSafeProductionGroupBuyService } from './bigint-safe-production-group-buy.service';

function createService() {
  const now = Date.now();
  const activityId = 8000000000000001n;
  const groupA = 9007199254740992n;
  const groupB = 9007199254740993n;
  const leaderA = 9100000000000001n;
  const leaderB = 9100000000000002n;
  const prisma = {
    groupBuyActivity: {
      findFirst: jest.fn<any>().mockResolvedValue({
        id: activityId,
        status: 1,
        name: '测试拼团',
        startTime: new Date(now - 60_000),
        endTime: new Date(now + 60_000),
      }),
    },
    groupBuyGroup: {
      findMany: jest.fn<any>().mockResolvedValue([
        { id: groupA, activityId, leaderUserId: leaderA, status: 'forming', currentCount: 1, targetCount: 2 },
        { id: groupB, activityId, leaderUserId: leaderB, status: 'forming', currentCount: 1, targetCount: 2 },
      ]),
      findFirst: jest.fn<any>().mockResolvedValue({
        id: groupA,
        activityId,
        leaderUserId: leaderA,
        status: 'forming',
        groupNo: 'GB-A',
      }),
    },
    groupBuyMember: {
      findMany: jest.fn<any>().mockResolvedValue([
        {
          id: 1n,
          groupId: groupA,
          userId: 101n,
          orderId: 1001n,
          role: 'leader',
          status: 'paid',
          paidAt: new Date(),
          createdAt: new Date(),
        },
        {
          id: 2n,
          groupId: groupB,
          userId: 202n,
          orderId: 1002n,
          role: 'member',
          status: 'pending_payment',
          paidAt: null,
          createdAt: new Date(),
        },
      ]),
    },
    user: {
      findMany: jest.fn<any>().mockResolvedValue([
        { id: leaderA, nickname: '团长A', avatarUrl: 'a.jpg' },
        { id: leaderB, nickname: '团长B', avatarUrl: 'b.jpg' },
        { id: 101n, nickname: '成员A', avatarUrl: 'member-a.jpg' },
        { id: 202n, nickname: '成员B', avatarUrl: 'member-b.jpg' },
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
  it('超过 JS 安全整数的相邻团 ID 不会串成员，且公开列表不泄漏内部用户 ID', async () => {
    const { service, groupA, groupB } = createService();
    expect(Number(groupA)).toBe(Number(groupB));

    const result = await service.weappFindAvailableGroups('8000000000000001');

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(groupA);
    expect(result[0].members).toEqual([
      expect.objectContaining({ role: 'leader', status: 'paid' }),
    ]);
    expect(result[0]).not.toHaveProperty('leaderUserId');
    expect(result[0].leader).toEqual({ nickname: '团长A', avatarUrl: 'a.jpg' });
    expect(result[0].leader).not.toHaveProperty('id');
    expect(result[0].members[0]).not.toHaveProperty('userId');
    expect(result[0].members[0]).not.toHaveProperty('id');

    expect(result[1].id).toBe(groupB);
    expect(result[1].members).toEqual([
      expect.objectContaining({ role: 'member', status: 'pending_payment' }),
    ]);
    expect(result[1].leader).toEqual({ nickname: '团长B', avatarUrl: 'b.jpg' });
  });

  it('公开团详情移除成员 userId/orderId 与 leaderUserId，只保留公开资料', async () => {
    const { service } = createService();

    const result = await service.weappFindGroupById('9007199254740992');

    expect(result).not.toHaveProperty('leaderUserId');
    expect(result.members[0]).toMatchObject({
      role: 'leader',
      status: 'paid',
      user: { nickname: '成员A', avatarUrl: 'member-a.jpg' },
    });
    expect(result.members[0]).not.toHaveProperty('id');
    expect(result.members[0]).not.toHaveProperty('userId');
    expect(result.members[0]).not.toHaveProperty('orderId');
    expect(result.members[0].user).not.toHaveProperty('id');
  });
});
