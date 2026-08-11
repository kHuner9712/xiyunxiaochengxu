import assert from 'node:assert/strict';
import { POINTS_SHARE_AWARD, POINTS_SHARE_DAILY_LIMIT } from '@baby-mall/shared';
import { BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { AtomicShareProductionService } from '../src/share/atomic-share-production.service';

const MYSQL_SIGNED_INT_MAX = 2_147_483_647;

function assertSafeIntegrationDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const databaseName = decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\//, ''));
  if (
    !/(^|[_-])test($|[_-])/i.test(databaseName) &&
    process.env.ALLOW_DESTRUCTIVE_INTEGRATION_TESTS !== 'true'
  ) {
    throw new Error(`Refusing destructive integration test against database "${databaseName}"`);
  }
}

assertSafeIntegrationDatabase();
const prisma = new PrismaClient();

async function main() {
  await prisma.$connect();
  const suffix = Date.now().toString();
  const userIds: bigint[] = [];

  const service = new AtomicShareProductionService(
    prisma as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );

  try {
    const normalUser = await prisma.user.create({
      data: { openid: `share-atomic-normal-${suffix}`, nickname: '分享原子积分用户' },
    });
    userIds.push(normalUser.id);

    const normalResults = [];
    for (let index = 0; index < POINTS_SHARE_DAILY_LIMIT + 1; index += 1) {
      normalResults.push(await service.recordShare(normalUser.id.toString(), {
        shareType: 'home',
        shareChannel: 'wechat',
      }));
    }

    assert.equal(normalResults.length, POINTS_SHARE_DAILY_LIMIT + 1);
    for (let index = 0; index < POINTS_SHARE_DAILY_LIMIT; index += 1) {
      assert.equal(normalResults[index].pointsAwarded, POINTS_SHARE_AWARD);
      assert.equal(normalResults[index].todayShareCount, index + 1);
    }
    assert.equal(
      normalResults[POINTS_SHARE_DAILY_LIMIT].pointsAwarded,
      0,
      '超过每日奖励上限后仍应记录分享，但不能继续发积分',
    );

    const [normalShareCount, normalRewardRecords, normalUserAfter] = await Promise.all([
      prisma.shareRecord.count({ where: { userId: normalUser.id } }),
      prisma.pointsRecord.count({ where: { userId: normalUser.id, source: 'share', type: 1 } }),
      prisma.user.findUniqueOrThrow({ where: { id: normalUser.id } }),
    ]);
    assert.equal(normalShareCount, POINTS_SHARE_DAILY_LIMIT + 1);
    assert.equal(normalRewardRecords, POINTS_SHARE_DAILY_LIMIT);
    assert.equal(normalUserAfter.availablePoints, POINTS_SHARE_DAILY_LIMIT * POINTS_SHARE_AWARD);
    assert.equal(normalUserAfter.totalPoints, POINTS_SHARE_DAILY_LIMIT * POINTS_SHARE_AWARD);

    // Simulate a record left by the historical implementation: the share row committed but the
    // points transaction failed. The next share must repair that eligible record atomically.
    const recoveryUser = await prisma.user.create({
      data: { openid: `share-atomic-recovery-${suffix}`, nickname: '分享漏发恢复用户' },
    });
    userIds.push(recoveryUser.id);
    const historicalShare = await prisma.shareRecord.create({
      data: {
        userId: recoveryUser.id,
        shareType: 'home',
        shareChannel: 'wechat',
        inviterUserId: recoveryUser.id,
        shareScene: 'home',
        sceneCode: `legacy${suffix}`.slice(0, 32),
      },
    });

    const recovered = await service.recordShare(recoveryUser.id.toString(), {
      shareType: 'home',
      shareChannel: 'wechat',
    });
    const currentEligible = POINTS_SHARE_DAILY_LIMIT > 1;
    assert.equal(recovered.recoveredPoints, POINTS_SHARE_AWARD);
    assert.equal(recovered.pointsAwarded, currentEligible ? POINTS_SHARE_AWARD : 0);

    const historicalReward = await prisma.pointsRecord.findFirst({
      where: { source: 'share', sourceId: historicalShare.id, userId: recoveryUser.id },
    });
    assert.ok(historicalReward, '历史已记录但漏发的合资格分享必须自动补积分');
    const recoveryUserAfter = await prisma.user.findUniqueOrThrow({ where: { id: recoveryUser.id } });
    const expectedRecoveryPoints = POINTS_SHARE_AWARD + (currentEligible ? POINTS_SHARE_AWARD : 0);
    assert.equal(recoveryUserAfter.availablePoints, expectedRecoveryPoints);
    assert.equal(recoveryUserAfter.totalPoints, expectedRecoveryPoints);

    // Prove rollback after shareRecord.create: the service deliberately creates the share row
    // before the points overflow check. A business error must still leave no committed share slot.
    const overflowUser = await prisma.user.create({
      data: {
        openid: `share-atomic-overflow-${suffix}`,
        nickname: '分享积分上限用户',
        totalPoints: MYSQL_SIGNED_INT_MAX,
        availablePoints: MYSQL_SIGNED_INT_MAX,
      },
    });
    userIds.push(overflowUser.id);

    await assert.rejects(
      service.recordShare(overflowUser.id.toString(), {
        shareType: 'home',
        shareChannel: 'wechat',
      }),
      (error: unknown) => {
        assert.ok(error instanceof BadRequestException);
        assert.match(error.message, /积分余额已达上限/);
        return true;
      },
    );
    assert.equal(
      await prisma.shareRecord.count({ where: { userId: overflowUser.id } }),
      0,
      '积分发放失败必须回滚同一事务内刚创建的分享记录，不能白耗每日奖励次数',
    );
    assert.equal(
      await prisma.pointsRecord.count({ where: { userId: overflowUser.id, source: 'share' } }),
      0,
    );

    console.log('[share-reward-lifecycle-integration] PASS');
  } finally {
    if (userIds.length) {
      await prisma.userInviteReward.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.userInviteRelation.deleteMany({
        where: {
          OR: [
            { inviterUserId: { in: userIds } },
            { inviteeUserId: { in: userIds } },
          ],
        },
      });
      await prisma.pointsRecord.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.shareRecord.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error('[share-reward-lifecycle-integration] FAIL', error);
  await prisma.$disconnect().catch(() => undefined);
  process.exitCode = 1;
});
