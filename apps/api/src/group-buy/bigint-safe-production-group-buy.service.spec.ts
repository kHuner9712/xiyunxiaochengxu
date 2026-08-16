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
        { id: 2n, groupId: groupB, userId: 202n, role: 'member', status: 'pending_payment', paidAt: null },
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
  return { service, prisma, groupA, groupB };
}

describe('BigintSafeProductionGroupBuyService', () => {
  it('超过 JS 安全整数的相邻团 ID 不会串成员', async () => {
    const { service, groupA, groupB } = createService();
    expect(Number(groupA)).toBe(Number(groupB));

    const result = await service.weappFindAvailableGroups('8000000000000001');

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(groupA);
    expect(result[0].members.map((member) => member.userId)).toEqual([101n]);
    expect(result[0].leader?.nickname).toBe('团长A');
    expect(result[1].id).toBe(groupB);
    expect(result[1].members.map((member) => member.userId)).toEqual([202n]);
    expect(result[1].leader?.nickname).toBe('团长B');
  });

  it('我的拼团仅返回页面所需字段，不泄露团长内部用户 ID', async () => {
    const leaderUserId = 9100000000000001n;
    const groupId = 9007199254740993n;
    const activityId = 8000000000000001n;
    const now = new Date();
    const prisma = {
      groupBuyMember: {
        findMany: jest.fn<any>().mockResolvedValue([{ groupId }]),
      },
      groupBuyGroup: {
        findMany: jest.fn<any>().mockResolvedValue([{
          id: groupId,
          activityId,
          leaderUserId,
          status: 'forming',
          groupNo: 'GB001',
          currentCount: 1,
          targetCount: 2,
          expiresAt: new Date(now.getTime() + 60_000),
          successAt: null,
          failedAt: null,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        }]),
        count: jest.fn<any>().mockResolvedValue(1),
      },
      groupBuyActivity: {
        findMany: jest.fn<any>().mockResolvedValue([{
          id: activityId,
          name: '测试拼团',
          coverImage: 'cover.jpg',
          groupPrice: 9900,
          groupSize: 2,
        }]),
      },
    };
    const service = new BigintSafeProductionGroupBuyService(
      prisma as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const result: any = await service.weappFindMyGroups('123', { page: 1, pageSize: 20 });

    expect(result.list[0]).toMatchObject({
      id: groupId.toString(),
      activityId: activityId.toString(),
      groupNo: 'GB001',
      status: 'forming',
    });
    expect(result.list[0]).not.toHaveProperty('leaderUserId');
    expect(result.list[0]).not.toHaveProperty('deletedAt');
    expect(result.list[0]).not.toHaveProperty('updatedAt');
    expect(result.list[0].activity.id).toBe(activityId.toString());
  });

  it.each(['abc', '0', '-1', '9223372036854775808'])(
    '公开团详情拒绝非法 ID %s，而不是让 BigInt 转换异常逃逸为 500',
    async (id) => {
      const { service } = createService();
      await expect(service.weappFindGroupById(id)).rejects.toThrow(/团ID(无效|超出范围)/);
    },
  );

  it.each(['abc', '0', '-1', '9223372036854775808'])(
    '拼团活动详情拒绝非法 ID %s，而不是让 BigInt 转换异常逃逸为 500',
    async (id) => {
      const { service, prisma } = createService();
      await expect(service.weappFindActivityById(id)).rejects.toThrow(/活动ID(无效|超出范围)/);
      expect(prisma.groupBuyActivity.findFirst).not.toHaveBeenCalled();
    },
  );

  it('拼团活动详情携带服务器时间供小程序校准活动状态', async () => {
    const { service } = createService();
    const before = Date.now();
    const result: any = await service.weappFindActivityById('8000000000000001');
    const after = Date.now();
    const serverNow = new Date(result.now).getTime();

    expect(Number.isFinite(serverNow)).toBe(true);
    expect(serverNow).toBeGreaterThanOrEqual(before);
    expect(serverNow).toBeLessThanOrEqual(after);
  });
});
