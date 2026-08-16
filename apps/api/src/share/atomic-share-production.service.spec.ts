import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { AtomicShareProductionService } from './atomic-share-production.service';
import { SafeShareProductionService } from './safe-share-production.service';

function createService(activeCampaign: { id: bigint } | null = { id: 55n }) {
  const prisma = {
    shareCampaign: {
      findFirst: jest.fn<any>().mockResolvedValue(activeCampaign),
    },
  };
  const service = new AtomicShareProductionService(
    prisma as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );
  return { service, prisma };
}

describe('AtomicShareProductionService direct invite attribution', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('只有 inviter 的邀请链接自动归因到当前有效邀新活动', async () => {
    const { service, prisma } = createService({ id: 55n });
    const parentBind = jest
      .spyOn(SafeShareProductionService.prototype, 'bindInvite')
      .mockResolvedValue({ bound: true, relationId: '1' } as any);

    const result = await service.bindInvite('200', { inviter: '100' });

    expect(result).toEqual({ bound: true, relationId: '1' });
    expect(prisma.shareCampaign.findFirst).toHaveBeenCalledWith({
      where: {
        type: 'invite_new_user',
        status: 1,
        startTime: { lte: expect.any(Date) },
        endTime: { gte: expect.any(Date) },
        deletedAt: null,
      },
      orderBy: [{ startTime: 'desc' }, { id: 'desc' }],
      select: { id: true },
    });
    expect(parentBind).toHaveBeenCalledWith('200', {
      inviter: '100',
      campaignId: '55',
    });
  });

  it('显式 campaignId 保持精确归因，不被默认邀新活动覆盖', async () => {
    const { service, prisma } = createService({ id: 55n });
    const parentBind = jest
      .spyOn(SafeShareProductionService.prototype, 'bindInvite')
      .mockResolvedValue({ bound: true, relationId: '2' } as any);

    await service.bindInvite('200', { inviter: '100', campaignId: '99' });

    expect(prisma.shareCampaign.findFirst).not.toHaveBeenCalled();
    expect(parentBind).toHaveBeenCalledWith('200', {
      inviter: '100',
      campaignId: '99',
    });
  });

  it('显式 shareRecordId 保持分享记录归因，不自动附加活动', async () => {
    const { service, prisma } = createService({ id: 55n });
    const parentBind = jest
      .spyOn(SafeShareProductionService.prototype, 'bindInvite')
      .mockResolvedValue({ bound: true, relationId: '3' } as any);

    await service.bindInvite('200', { inviter: '100', shareRecordId: '88' });

    expect(prisma.shareCampaign.findFirst).not.toHaveBeenCalled();
    expect(parentBind).toHaveBeenCalledWith('200', {
      inviter: '100',
      shareRecordId: '88',
    });
  });

  it('没有有效邀新活动时仍保留原有纯邀请关系语义', async () => {
    const { service } = createService(null);
    const parentBind = jest
      .spyOn(SafeShareProductionService.prototype, 'bindInvite')
      .mockResolvedValue({ bound: true, relationId: '4' } as any);

    await service.bindInvite('200', { inviter: '100' });

    expect(parentBind).toHaveBeenCalledWith('200', { inviter: '100' });
  });
});
