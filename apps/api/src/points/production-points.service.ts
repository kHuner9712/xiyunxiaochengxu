import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { PointsService } from './points.service';

@Injectable()
export class ProductionPointsService extends PointsService {
  private readonly productionLogger = new Logger(ProductionPointsService.name);

  constructor(
    private readonly productionPrisma: PrismaService,
    redisService: RedisService,
  ) {
    super(productionPrisma, redisService);
  }

  override async getBalance(userId: string) {
    const userIdValue = parsePositiveBigIntId(userId, '用户');
    const [user, spentAggregate, expiredAggregate] = await Promise.all([
      this.productionPrisma.user.findFirst({
        where: { id: userIdValue, deletedAt: null },
        select: { availablePoints: true, totalPoints: true },
      }),
      this.productionPrisma.pointsRecord.aggregate({
        where: { userId: userIdValue, type: 2 },
        _sum: { points: true },
      }),
      this.productionPrisma.pointsRecord.aggregate({
        where: { userId: userIdValue, type: 3 },
        _sum: { points: true },
      }),
    ]);

    if (!user) {
      return {
        balance: 0,
        totalEarned: 0,
        totalSpent: 0,
        totalExpired: 0,
        availablePoints: 0,
        totalPoints: 0,
        frozenPoints: 0,
      };
    }

    return {
      balance: user.availablePoints,
      totalEarned: user.totalPoints,
      totalSpent: spentAggregate._sum.points ?? 0,
      totalExpired: expiredAggregate._sum.points ?? 0,
      availablePoints: user.availablePoints,
      totalPoints: user.totalPoints,
      frozenPoints: 0,
    };
  }

  override async getSignInStatus(userId: string) {
    const canonicalUserId = parsePositiveBigIntId(userId, '用户').toString();
    const status = await super.getSignInStatus(canonicalUserId);
    if (!status.todaySigned) return status;

    // The base helper counts the consecutive days before today because it starts at yesterday.
    // Once today is signed, the current streak includes today as one additional day.
    const continuous = (status.consecutiveDays ?? 0) + 1;
    return {
      ...status,
      continuous,
      consecutiveDays: continuous,
    };
  }

  override async signIn(userId: string) {
    const canonicalUserId = parsePositiveBigIntId(userId, '用户').toString();
    const result = await super.signIn(canonicalUserId);
    if (!result.alreadySigned) return result;

    // A retry from another device or a stale foreground page is an idempotent success. Return the
    // actual streak instead of the base fallback of zero so clients cannot regress the UI state.
    const status = await this.getSignInStatus(canonicalUserId);
    return {
      ...result,
      continuous: status.continuous,
      consecutiveDays: status.consecutiveDays,
    };
  }

  override async cleanExpiredPoints() {
    const now = new Date();
    const candidates = await this.productionPrisma.$queryRaw<Array<{
      id: bigint;
      userId: bigint;
      points: number;
    }>>`
      SELECT r.id AS id, r.user_id AS userId, r.points AS points
      FROM points_records r
      WHERE r.type = 1
        AND r.expire_at IS NOT NULL
        AND r.expire_at <= ${now}
        AND NOT EXISTS (
          SELECT 1
          FROM points_records marker
          WHERE marker.source IN ('expire', 'expire_marker')
            AND marker.source_id = r.id
        )
      ORDER BY r.expire_at ASC, r.id ASC
      LIMIT 1000
    `;

    let cleanedCount = 0;
    let skippedCount = 0;
    let deductedPoints = 0;

    for (const candidate of candidates) {
      try {
        const result = await this.productionPrisma.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT id FROM users WHERE id = ${candidate.userId} FOR UPDATE`;
          await tx.$queryRaw`SELECT id FROM points_records WHERE id = ${candidate.id} FOR UPDATE`;

          const marker = await tx.pointsRecord.findFirst({
            where: {
              source: { in: ['expire', 'expire_marker'] },
              sourceId: candidate.id,
            },
            select: { id: true },
          });
          if (marker) return { processed: false, deducted: 0 };

          const [user, candidateRecord] = await Promise.all([
            tx.user.findFirst({
              where: { id: candidate.userId, deletedAt: null },
              select: { availablePoints: true },
            }),
            tx.pointsRecord.findFirst({
              where: { id: candidate.id, userId: candidate.userId, type: 1 },
              select: { id: true, points: true, createdAt: true },
            }),
          ]);
          if (!user || !candidateRecord) return { processed: false, deducted: 0 };

          // FIFO ledger accounting: deductions consume the oldest earned points first. Therefore
          // the amount still owned by this earning is the positive remainder of cumulative earns
          // through this record after all consumption/expiry deductions recorded so far.
          const [earnedThroughCandidate, deductionAggregate] = await Promise.all([
            tx.pointsRecord.aggregate({
              where: {
                userId: candidate.userId,
                type: 1,
                OR: [
                  { createdAt: { lt: candidateRecord.createdAt } },
                  { createdAt: candidateRecord.createdAt, id: { lte: candidateRecord.id } },
                ],
              },
              _sum: { points: true },
            }),
            tx.pointsRecord.aggregate({
              where: {
                userId: candidate.userId,
                type: { in: [2, 3] },
                createdAt: { lte: now },
              },
              _sum: { points: true },
            }),
          ]);

          const cumulativeEarned = Math.max(0, earnedThroughCandidate._sum.points ?? 0);
          const cumulativeDeducted = Math.max(0, deductionAggregate._sum.points ?? 0);
          const fifoRemainderThroughCandidate = Math.max(0, cumulativeEarned - cumulativeDeducted);
          const unspentFromCandidate = Math.min(candidateRecord.points, fifoRemainderThroughCandidate);
          const deduct = Math.min(user.availablePoints, Math.max(0, unspentFromCandidate));

          if (deduct > 0) {
            const claim = await tx.user.updateMany({
              where: { id: candidate.userId, availablePoints: { gte: deduct } },
              data: { availablePoints: { decrement: deduct } },
            });
            if (claim.count === 0) {
              throw new Error(`用户${candidate.userId}积分余额并发变化，稍后重试`);
            }
          }

          const latestUser = await tx.user.findUnique({
            where: { id: candidate.userId },
            select: { availablePoints: true },
          });
          await tx.pointsRecord.create({
            data: {
              userId: candidate.userId,
              type: 3,
              points: deduct,
              balance: latestUser?.availablePoints ?? Math.max(0, user.availablePoints - deduct),
              source: 'expire',
              sourceId: candidate.id,
              description: deduct > 0
                ? `积分到期，按FIFO扣除该笔剩余${deduct}积分`
                : '积分到期，该笔积分已在到期前消费，无需再次扣减',
            },
          });
          return { processed: true, deducted: deduct };
        });

        if (result.processed) {
          cleanedCount += 1;
          deductedPoints += result.deducted;
        } else {
          skippedCount += 1;
        }
      } catch (error: any) {
        if (error?.code === 'P2002') {
          skippedCount += 1;
          continue;
        }
        this.productionLogger.error(
          `清理过期积分失败: record=${candidate.id} user=${candidate.userId} message=${error?.message || error}`,
        );
      }
    }

    this.productionLogger.log(
      `积分过期清理完成: processed=${cleanedCount}, skipped=${skippedCount}, deducted=${deductedPoints}`,
    );
    return { cleanedCount, skippedCount, deductedPoints };
  }
}
