import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { PointsService } from './points.service';

const CHINA_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

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
    const [status, previousConsecutiveDays] = await Promise.all([
      super.getSignInStatus(canonicalUserId),
      this.getFullPreviousConsecutiveSignInDays(canonicalUserId),
    ]);

    const continuous = previousConsecutiveDays + (status.todaySigned ? 1 : 0);
    return {
      ...status,
      continuous,
      consecutiveDays: continuous,
    };
  }

  override async signIn(userId: string) {
    const canonicalUserId = parsePositiveBigIntId(userId, '用户').toString();
    const result = await super.signIn(canonicalUserId);

    // The base implementation intentionally keeps its historical scan small. Enrich the response
    // with the full streak after the idempotent/new sign-in transaction has committed, without ever
    // turning a successful sign-in into a client-visible failure if this read-back is unavailable.
    try {
      const status = await this.getSignInStatus(canonicalUserId);
      return {
        ...result,
        continuous: status.continuous,
        consecutiveDays: status.consecutiveDays,
      };
    } catch (error: any) {
      this.productionLogger.warn(
        `签到成功后刷新完整连续天数失败，保留事务返回值: user=${canonicalUserId} message=${error?.message || error}`,
      );
      return result;
    }
  }

  private async getFullPreviousConsecutiveSignInDays(userId: string): Promise<number> {
    const userIdValue = parsePositiveBigIntId(userId, '用户');
    const records = await this.productionPrisma.pointsRecord.findMany({
      where: {
        userId: userIdValue,
        source: 'sign_in',
        type: 1,
      },
      select: { createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    // At most one successful sign-in exists per China calendar day. Reading the user's sign-in
    // history is bounded in practice by account age (one row/day), and removes the old arbitrary
    // 30-day cap. A Set also tolerates legacy duplicate rows without inflating the streak.
    const signedDays = new Set(records.map((record) => this.toChinaDayKey(record.createdAt)));
    const now = Date.now();
    let consecutiveDays = 0;
    for (let offset = -1; ; offset -= 1) {
      const expectedDay = this.toChinaDayKey(new Date(now + offset * DAY_MS));
      if (!signedDays.has(expectedDay)) break;
      consecutiveDays += 1;
    }
    return consecutiveDays;
  }

  private toChinaDayKey(value: Date): string {
    return new Date(value.getTime() + CHINA_UTC_OFFSET_MS).toISOString().slice(0, 10);
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
