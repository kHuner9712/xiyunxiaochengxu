import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ShareService } from './share.service';
import { BadRequestException } from '@nestjs/common';

function createMockPrisma() {
  return {
    shareRecord: {
      create: jest.fn() as any,
      findFirst: jest.fn() as any,
      update: jest.fn() as any,
      findMany: jest.fn() as any,
      count: jest.fn() as any,
      aggregate: jest.fn() as any,
    },
    userInviteRelation: {
      create: jest.fn() as any,
      findFirst: jest.fn() as any,
      findMany: jest.fn() as any,
      count: jest.fn() as any,
      update: jest.fn() as any,
    },
    shareCampaign: {
      create: jest.fn() as any,
      findFirst: jest.fn() as any,
      findMany: jest.fn() as any,
      count: jest.fn() as any,
      update: jest.fn() as any,
    },
    pointsRecord: {
      findFirst: jest.fn() as any,
      findMany: jest.fn() as any,
    },
    product: {
      findFirst: jest.fn() as any,
    },
    user: {
      findFirst: jest.fn() as any,
    },
  };
}

function createMockRedis() {
  const incr = jest.fn() as any;
  incr.mockResolvedValue(1);
  const expire = jest.fn() as any;
  const get = jest.fn() as any;
  get.mockResolvedValue(null);
  const set = jest.fn() as any;
  return { incr, expire, get, set };
}

function createMockPointsService() {
  const earnPoints = jest.fn() as any;
  earnPoints.mockResolvedValue({});
  return { earnPoints };
}

function createMockCouponService() {
  const receive = jest.fn() as any;
  receive.mockResolvedValue({});
  return { receive };
}

describe('ShareService', () => {
  let service: ShareService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let redis: ReturnType<typeof createMockRedis>;
  let pointsService: ReturnType<typeof createMockPointsService>;
  let couponService: ReturnType<typeof createMockCouponService>;

  beforeEach(() => {
    prisma = createMockPrisma();
    redis = createMockRedis();
    pointsService = createMockPointsService();
    couponService = createMockCouponService();
    service = new ShareService(
      prisma as any,
      redis as any,
      pointsService as any,
      couponService as any,
    );
    jest.spyOn(service['logger'], 'log').mockImplementation(() => {});
    jest.spyOn(service['logger'], 'error').mockImplementation(() => {});
  });

  describe('recordShare', () => {
    it('should create share record and award points', async () => {
      prisma.shareRecord.create.mockResolvedValue({
        id: BigInt(1),
        userId: BigInt(100),
        shareType: 'product',
        sceneCode: 'ABC12345',
      });

      const result = await service.recordShare('100', {
        shareType: 'product',
        shareTargetId: '200',
      });

      expect(result.success).toBe(true);
      expect(result.shareRecordId).toBe('1');
      expect(result.sceneCode).toBeTruthy();
      expect(result.sceneCode.length).toBe(8);
      expect(result.pointsAwarded).toBe(2);
      expect(prisma.shareRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: BigInt(100),
            shareType: 'product',
            shareId: BigInt(200),
          }),
        })
      );
      expect(pointsService.earnPoints).toHaveBeenCalled();
    });

    it('should not award points when daily limit exceeded', async () => {
      redis.incr.mockResolvedValue(11);
      prisma.shareRecord.create.mockResolvedValue({
        id: BigInt(2),
        userId: BigInt(100),
        shareType: 'home',
        sceneCode: 'XYZ98765',
      });

      const result = await service.recordShare('100', { shareType: 'home' });

      expect(result.pointsAwarded).toBe(0);
      expect(pointsService.earnPoints).not.toHaveBeenCalled();
    });
  });

  describe('recordVisit', () => {
    it('should increment clickCount when shareRecordId provided', async () => {
      prisma.shareRecord.findFirst.mockResolvedValue({
        id: BigInt(1),
        clickCount: 5,
      });
      prisma.shareRecord.update.mockResolvedValue({ id: BigInt(1) });

      const result = await service.recordVisit({ shareRecordId: '1' });

      expect(result.recorded).toBe(true);
      expect(prisma.shareRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: BigInt(1) },
          data: { clickCount: { increment: 1 } },
        })
      );
    });

    it('should find record by sceneCode', async () => {
      prisma.shareRecord.findFirst.mockResolvedValue({
        id: BigInt(2),
        clickCount: 0,
      });
      prisma.shareRecord.update.mockResolvedValue({ id: BigInt(2) });

      const result = await service.recordVisit({ sceneCode: 'ABC12345' });

      expect(result.recorded).toBe(true);
      expect(prisma.shareRecord.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sceneCode: 'ABC12345' },
        })
      );
    });

    it('should store inviter info in redis when no shareRecordId', async () => {
      prisma.shareRecord.findFirst.mockResolvedValue(null);

      const result = await service.recordVisit({ inviter: '100', campaignId: '5' });

      expect(result.recorded).toBe(true);
      expect(redis.set).toHaveBeenCalled();
    });
  });

  describe('bindInvite', () => {
    it('should throw when inviting self', async () => {
      await expect(
        service.bindInvite('100', { inviter: '100' })
      ).rejects.toThrow(BadRequestException);
    });

    it('should return already_invited when invitee already bound', async () => {
      prisma.userInviteRelation.findFirst.mockResolvedValue({
        id: BigInt(1),
        inviteeUserId: BigInt(200),
      });

      const result = await service.bindInvite('200', { inviter: '100' });

      expect(result.bound).toBe(false);
      expect(result.reason).toBe('already_invited');
    });

    it('should bind invite relation successfully', async () => {
      prisma.userInviteRelation.findFirst.mockResolvedValue(null);
      prisma.userInviteRelation.create.mockResolvedValue({
        id: BigInt(1),
        inviterUserId: BigInt(100),
        inviteeUserId: BigInt(200),
      });

      const result = await service.bindInvite('200', { inviter: '100' });

      expect(result.bound).toBe(true);
      expect(result.relationId).toBe('1');
      expect(prisma.userInviteRelation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            inviterUserId: BigInt(100),
            inviteeUserId: BigInt(200),
          }),
        })
      );
    });

    it('should prevent self-invite via shareRecord', async () => {
      prisma.userInviteRelation.findFirst.mockResolvedValue(null);
      prisma.shareRecord.findFirst.mockResolvedValue({
        id: BigInt(1),
        inviterUserId: BigInt(100),
        userId: BigInt(100),
      });

      await expect(
        service.bindInvite('100', { shareRecordId: '1' })
      ).rejects.toThrow(BadRequestException);
    });

    it('should return no_inviter when no inviter found', async () => {
      prisma.userInviteRelation.findFirst.mockResolvedValue(null);
      prisma.shareRecord.findFirst.mockResolvedValue(null);

      const result = await service.bindInvite('200', {});

      expect(result.bound).toBe(false);
      expect(result.reason).toBe('no_inviter');
    });
  });

  describe('processFirstPaidReward', () => {
    it('should skip if already rewarded (idempotent)', async () => {
      prisma.userInviteRelation.findFirst.mockResolvedValue({
        id: BigInt(1),
        inviterUserId: BigInt(100),
        inviteeUserId: BigInt(200),
        firstPaidOrderId: BigInt(999),
        sourceCampaignId: BigInt(5),
      });

      await service.processFirstPaidReward('200', '888', 1000);

      expect(pointsService.earnPoints).not.toHaveBeenCalled();
      expect(couponService.receive).not.toHaveBeenCalled();
    });

    it('should skip if no invite relation found', async () => {
      prisma.userInviteRelation.findFirst.mockResolvedValue(null);

      await service.processFirstPaidReward('200', '888', 1000);

      expect(pointsService.earnPoints).not.toHaveBeenCalled();
    });

    it('should skip if campaign expired', async () => {
      prisma.userInviteRelation.findFirst.mockResolvedValue({
        id: BigInt(1),
        inviterUserId: BigInt(100),
        inviteeUserId: BigInt(200),
        firstPaidOrderId: null,
        sourceShareRecordId: BigInt(10),
        sourceCampaignId: BigInt(5),
      });
      prisma.userInviteRelation.update.mockResolvedValue({});
      prisma.shareRecord.update.mockResolvedValue({});
      prisma.shareCampaign.findFirst.mockResolvedValue({
        id: BigInt(5),
        status: 1,
        startTime: new Date('2020-01-01'),
        endTime: new Date('2020-12-31'),
        rewardType: 'points',
        inviterRewardConfig: { points: 50 },
      });

      await service.processFirstPaidReward('200', '888', 1000);

      expect(pointsService.earnPoints).not.toHaveBeenCalled();
    });

    it('should award inviter points on first paid order', async () => {
      const futureDate = new Date('2030-12-31');
      prisma.userInviteRelation.findFirst.mockResolvedValue({
        id: BigInt(1),
        inviterUserId: BigInt(100),
        inviteeUserId: BigInt(200),
        firstPaidOrderId: null,
        sourceShareRecordId: BigInt(10),
        sourceCampaignId: BigInt(5),
      });
      prisma.userInviteRelation.update.mockResolvedValue({});
      prisma.shareRecord.update.mockResolvedValue({});
      prisma.shareCampaign.findFirst.mockResolvedValue({
        id: BigInt(5),
        status: 1,
        startTime: new Date('2020-01-01'),
        endTime: futureDate,
        rewardType: 'points',
        inviterRewardConfig: { points: 50 },
      });
      prisma.pointsRecord.findFirst.mockResolvedValue(null);

      await service.processFirstPaidReward('200', '888', 1000);

      expect(pointsService.earnPoints).toHaveBeenCalledWith(
        '100',
        50,
        'inviter_first_paid',
        '888',
        expect.any(String),
      );
    });

    it('should not double-award points (idempotent via pointsRecord check)', async () => {
      const futureDate = new Date('2030-12-31');
      prisma.userInviteRelation.findFirst.mockResolvedValue({
        id: BigInt(1),
        inviterUserId: BigInt(100),
        inviteeUserId: BigInt(200),
        firstPaidOrderId: null,
        sourceShareRecordId: BigInt(10),
        sourceCampaignId: BigInt(5),
      });
      prisma.userInviteRelation.update.mockResolvedValue({});
      prisma.shareRecord.update.mockResolvedValue({});
      prisma.shareCampaign.findFirst.mockResolvedValue({
        id: BigInt(5),
        status: 1,
        startTime: new Date('2020-01-01'),
        endTime: futureDate,
        rewardType: 'points',
        inviterRewardConfig: { points: 50 },
      });
      prisma.pointsRecord.findFirst.mockResolvedValue({
        id: BigInt(99),
        source: 'inviter_first_paid',
        sourceId: BigInt(888),
      });

      await service.processFirstPaidReward('200', '888', 1000);

      expect(pointsService.earnPoints).not.toHaveBeenCalled();
    });
  });
});
