import { describe, expect, it, jest } from '@jest/globals';
import { PublicGroupBuyViewService } from './public-group-buy-view.service';

function createViewService() {
  const groupBuyService = {
    weappFindAvailableGroups: jest.fn<any>().mockResolvedValue([
      {
        id: 9007199254740993n,
        activityId: 8000000000000001n,
        leaderUserId: 9100000000000001n,
        status: 'forming',
        groupNo: 'GB-1',
        currentCount: 1,
        targetCount: 2,
        expiresAt: new Date('2026-08-11T00:00:00Z'),
        successAt: null,
        failedAt: null,
        createdAt: new Date('2026-08-10T00:00:00Z'),
        updatedAt: new Date('2026-08-10T00:00:00Z'),
        deletedAt: null,
        members: [
          {
            id: 11n,
            groupId: 9007199254740993n,
            userId: 101n,
            role: 'leader',
            status: 'paid',
            paidAt: new Date('2026-08-10T00:01:00Z'),
          },
        ],
        leader: {
          id: 9100000000000001n,
          nickname: '公开团长',
          avatarUrl: 'avatar.jpg',
        },
      },
    ]),
    weappFindGroupById: jest.fn<any>().mockResolvedValue({
      id: 9007199254740993n,
      activityId: 8000000000000001n,
      leaderUserId: 9100000000000001n,
      status: 'forming',
      groupNo: 'GB-1',
      currentCount: 1,
      targetCount: 2,
      expiresAt: new Date('2026-08-11T00:00:00Z'),
      successAt: null,
      failedAt: null,
      createdAt: new Date('2026-08-10T00:00:00Z'),
      updatedAt: new Date('2026-08-10T00:00:00Z'),
      deletedAt: null,
      activity: {
        id: 8000000000000001n,
        name: '公开拼团',
        coverImage: 'cover.jpg',
        groupPrice: 9900,
        groupSize: 2,
      },
      members: [
        {
          id: 11n,
          userId: 101n,
          orderId: 7000000000000001n,
          role: 'leader',
          status: 'paid',
          paidAt: new Date('2026-08-10T00:01:00Z'),
          createdAt: new Date('2026-08-10T00:00:30Z'),
          user: {
            id: 101n,
            nickname: '公开成员',
            avatarUrl: 'member.jpg',
          },
        },
      ],
    }),
  };
  return {
    view: new PublicGroupBuyViewService(groupBuyService as any),
    groupBuyService,
  };
}

describe('PublicGroupBuyViewService', () => {
  it('可参团公开列表只返回业务展示字段并把 BIGINT ID 序列化为字符串', async () => {
    const { view } = createViewService();

    const result = await view.findAvailableGroups('8000000000000001');

    expect(result[0]).toMatchObject({
      id: '9007199254740993',
      activityId: '8000000000000001',
      leader: { nickname: '公开团长', avatarUrl: 'avatar.jpg' },
      members: [{ role: 'leader', status: 'paid' }],
    });
    expect(result[0]).not.toHaveProperty('leaderUserId');
    expect(result[0].leader).not.toHaveProperty('id');
    expect(result[0].members[0]).not.toHaveProperty('id');
    expect(result[0].members[0]).not.toHaveProperty('groupId');
    expect(result[0].members[0]).not.toHaveProperty('userId');
  });

  it('公开团详情不泄漏成员 userId/orderId 或内部用户 ID', async () => {
    const { view } = createViewService();

    const result = await view.findGroupById('9007199254740993');

    expect(result.id).toBe('9007199254740993');
    expect(result.activity?.id).toBe('8000000000000001');
    expect(result).not.toHaveProperty('leaderUserId');
    expect(result.members[0]).toMatchObject({
      role: 'leader',
      status: 'paid',
      user: { nickname: '公开成员', avatarUrl: 'member.jpg' },
    });
    expect(result.members[0]).not.toHaveProperty('id');
    expect(result.members[0]).not.toHaveProperty('userId');
    expect(result.members[0]).not.toHaveProperty('orderId');
    expect(result.members[0].user).not.toHaveProperty('id');
  });
});
