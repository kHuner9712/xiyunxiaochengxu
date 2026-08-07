import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { PointsQueryDto } from './dto/points-query.dto';
import { paginate, POINTS_SIGN_IN_BASE, POINTS_SIGN_IN_MAX, POINTS_DEDUCT_RATE, POINTS_DEDUCT_MAX_PERCENT, POINTS_EXPIRE_MONTHS } from '@baby-mall/shared';

const CHINA_OFFSET_MS = 8 * 60 * 60 * 1000;

@Injectable()
export class PointsService {
  private readonly logger = new Logger(PointsService.name);

  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {}

  async getBalance(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: BigInt(userId), deletedAt: null },
    });
    if (!user) {
      return {
        balance: 0,
        totalEarned: 0,
        totalSpent: 0,
        availablePoints: 0,
        totalPoints: 0,
        frozenPoints: 0,
      };
    }

    return {
      balance: user.availablePoints,
      totalEarned: user.totalPoints,
      totalSpent: 0,
      availablePoints: user.availablePoints,
      totalPoints: user.totalPoints,
      frozenPoints: 0,
    };
  }

  async findByUser(userId: string, dto: PointsQueryDto) {
    const where: any = { userId: BigInt(userId) };
    if (dto.type !== undefined) where.type = dto.type;
    if (dto.source) where.source = dto.source;

    const [list, total] = await Promise.all([
      this.prisma.pointsRecord.findMany({
        where,
        skip: dto.skip,
        take: dto.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.pointsRecord.count({ where }),
    ]);

    return paginate(
      list.map((r) => ({
        ...r,
        id: r.id.toString(),
        userId: r.userId.toString(),
        sourceId: r.sourceId?.toString(),
        createTime: r.createdAt,
        createdAt: r.createdAt,
      })),
      total,
      dto.page,
      dto.pageSize,
    );
  }

  async signIn(userId: string) {
    const userIdValue = BigInt(userId);
    const { start, end, key } = this.chinaDayBounds(0);
    const lockKey = `points:sign-in:${userId}:${key}`;
    const lockValue = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const locked = await this.redisService.setNX(lockKey, lockValue, 30);
    if (!locked) throw new BadRequestException('签到处理中，请勿重复提交');

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.pointsRecord.findFirst({
          where: {
            userId: userIdValue,
            source: 'sign_in',
            type: 1,
            createdAt: { gte: start, lt: end },
          },
        });

        if (existing) {
          return { alreadySigned: true, points: 0 };
        }

        await tx.$queryRaw`SELECT id FROM users WHERE id = ${userIdValue} FOR UPDATE`;
        const user = await tx.user.findFirst({ where: { id: userIdValue, deletedAt: null } });
        if (!user) throw new BadRequestException('用户不存在');

        const consecutiveDays = await this.getConsecutiveSignInDays(userId);
        const bonusPoints = Math.min(
          POINTS_SIGN_IN_BASE + consecutiveDays * 2,
          POINTS_SIGN_IN_MAX,
        );
        const newBalance = user.availablePoints + bonusPoints;
        const expireAt = this.createPointsExpireAt();

        await tx.user.update({
          where: { id: userIdValue },
          data: {
            totalPoints: { increment: bonusPoints },
            availablePoints: { increment: bonusPoints },
          },
        });

        await tx.pointsRecord.create({
          data: {
            userId: userIdValue,
            type: 1,
            points: bonusPoints,
            balance: newBalance,
            source: 'sign_in',
            description: `连续签到${consecutiveDays + 1}天，奖励${bonusPoints}积分`,
            expireAt,
          },
        });

        return { alreadySigned: false, points: bonusPoints, consecutiveDays: consecutiveDays + 1 };
      });

      if (!result.alreadySigned) {
        this.logger.log(`用户${userId}签到，获得${result.points}积分，连续${result.consecutiveDays}天`);
      }

      return {
        alreadySigned: result.alreadySigned,
        points: result.points,
        continuous: result.consecutiveDays ?? 0,
        consecutiveDays: result.consecutiveDays ?? 0,
      };
    } finally {
      await this.redisService.releaseLockWithLua(lockKey, lockValue);
    }
  }

  async getSignInStatus(userId: string) {
    const { start, end } = this.chinaDayBounds(0);
    const todaySigned = await this.prisma.pointsRecord.findFirst({
      where: {
        userId: BigInt(userId),
        source: 'sign_in',
        type: 1,
        createdAt: { gte: start, lt: end },
      },
    });

    const consecutiveDays = await this.getConsecutiveSignInDays(userId);

    return {
      checked: !!todaySigned,
      continuous: consecutiveDays,
      todayPoints: Math.min(POINTS_SIGN_IN_BASE + consecutiveDays * 2, POINTS_SIGN_IN_MAX),
      todaySigned: !!todaySigned,
      consecutiveDays,
      basePoints: POINTS_SIGN_IN_BASE,
      nextBonus: Math.min(POINTS_SIGN_IN_BASE + consecutiveDays * 2, POINTS_SIGN_IN_MAX),
    };
  }

  private async getConsecutiveSignInDays(userId: string): Promise<number> {
    let consecutiveDays = 0;
    for (let i = 1; i <= 30; i++) {
      const { start, end } = this.chinaDayBounds(-i);
      const record = await this.prisma.pointsRecord.findFirst({
        where: {
          userId: BigInt(userId),
          source: 'sign_in',
          type: 1,
          createdAt: { gte: start, lt: end },
        },
      });

      if (record) consecutiveDays++;
      else break;
    }
    return consecutiveDays;
  }

  async getRules() {
    return [
      {
        action: '每日签到',
        points: POINTS_SIGN_IN_BASE,
        dailyLimit: 1,
        description: `每日签到${POINTS_SIGN_IN_BASE}积分起，连续签到递增，最高${POINTS_SIGN_IN_MAX}积分`,
      },
      {
        action: '积分抵扣',
        points: 0,
        dailyLimit: 0,
        description: `每${POINTS_DEDUCT_RATE}积分抵扣1元，最多抵扣订单金额的${POINTS_DEDUCT_MAX_PERCENT}%`,
      },
      {
        action: '积分有效期',
        points: 0,
        dailyLimit: 0,
        description: `积分有效期为${POINTS_EXPIRE_MONTHS}个月，请在有效期内使用`,
      },
    ];
  }

  async earnPoints(userId: string, points: number, source: string, sourceId?: string, description?: string, expireMonths: number = POINTS_EXPIRE_MONTHS) {
    if (!Number.isSafeInteger(points) || points <= 0) {
      throw new BadRequestException('增加积分必须为正整数');
    }
    const userIdValue = BigInt(userId);
    const sourceIdValue = sourceId ? BigInt(sourceId) : null;

    try {
      await this.prisma.$transaction(async (tx) => {
        if (sourceIdValue !== null) {
          const existing = await tx.pointsRecord.findFirst({
            where: { source, sourceId: sourceIdValue },
            select: { id: true },
          });
          if (existing) return;
        }

        await tx.$queryRaw`SELECT id FROM users WHERE id = ${userIdValue} FOR UPDATE`;
        const user = await tx.user.findFirst({ where: { id: userIdValue, deletedAt: null } });
        if (!user) throw new BadRequestException('用户不存在');

        const newBalance = user.availablePoints + points;
        const expireAt = this.createPointsExpireAt(expireMonths);
        await tx.user.update({
          where: { id: userIdValue },
          data: {
            totalPoints: { increment: points },
            availablePoints: { increment: points },
          },
        });
        await tx.pointsRecord.create({
          data: {
            userId: userIdValue,
            type: 1,
            points,
            balance: newBalance,
            source,
            sourceId: sourceIdValue,
            description,
            expireAt,
          },
        });
      });
    } catch (error) {
      if ((error as any)?.code === 'P2002' && sourceIdValue !== null) return;
      throw error;
    }
  }

  async consumePoints(userId: string, points: number, source: string, sourceId?: string, description?: string) {
    if (!Number.isSafeInteger(points) || points <= 0) {
      throw new BadRequestException('扣减积分必须为正整数');
    }
    const userIdValue = BigInt(userId);
    const sourceIdValue = sourceId ? BigInt(sourceId) : null;

    try {
      await this.prisma.$transaction(async (tx) => {
        if (sourceIdValue !== null) {
          const existing = await tx.pointsRecord.findFirst({
            where: { source, sourceId: sourceIdValue },
            select: { id: true },
          });
          if (existing) return;
        }

        await tx.$queryRaw`SELECT id FROM users WHERE id = ${userIdValue} FOR UPDATE`;
        const user = await tx.user.findFirst({ where: { id: userIdValue, deletedAt: null } });
        if (!user) throw new BadRequestException('用户不存在');
        if (user.availablePoints < points) {
          throw new BadRequestException(`可用积分不足，当前可用${user.availablePoints}积分`);
        }

        const newBalance = user.availablePoints - points;
        await tx.user.update({
          where: { id: userIdValue },
          data: { availablePoints: { decrement: points } },
        });
        await tx.pointsRecord.create({
          data: {
            userId: userIdValue,
            type: 2,
            points,
            balance: newBalance,
            source,
            sourceId: sourceIdValue,
            description,
          },
        });
      });
    } catch (error) {
      if ((error as any)?.code === 'P2002' && sourceIdValue !== null) return;
      throw error;
    }
  }

  async adminAdjust(userId: string, points: number, description: string) {
    if (!Number.isSafeInteger(points) || points === 0) {
      throw new BadRequestException('调整积分必须为非零整数');
    }
    if (typeof description !== 'string' || !description.trim()) {
      throw new BadRequestException('请填写积分调整原因');
    }
    if (points > 0) {
      await this.earnPoints(userId, points, 'admin_adjust', undefined, description.trim());
    } else {
      await this.consumePoints(userId, Math.abs(points), 'admin_adjust', undefined, description.trim());
    }
    this.logger.log(`管理员调整用户${userId}积分：${points}`);
    return { success: true };
  }

  async cleanExpiredPoints() {
    const now = new Date();
    const expiredRecords = await this.prisma.$queryRaw<Array<{
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
    for (const record of expiredRecords) {
      try {
        const cleaned = await this.prisma.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT id FROM points_records WHERE id = ${record.id} FOR UPDATE`;
          const marker = await tx.pointsRecord.findFirst({
            where: {
              source: { in: ['expire', 'expire_marker'] },
              sourceId: record.id,
            },
            select: { id: true },
          });
          if (marker) return false;

          await tx.$queryRaw`SELECT id FROM users WHERE id = ${record.userId} FOR UPDATE`;
          const user = await tx.user.findFirst({
            where: { id: record.userId },
            select: { availablePoints: true },
          });
          if (!user) return false;

          const deductPoints = Math.min(Math.max(0, record.points), user.availablePoints);
          if (deductPoints > 0) {
            await tx.user.update({
              where: { id: record.userId },
              data: { availablePoints: { decrement: deductPoints } },
            });
          }
          await tx.pointsRecord.create({
            data: {
              userId: record.userId,
              type: 3,
              points: deductPoints,
              balance: user.availablePoints - deductPoints,
              source: 'expire',
              sourceId: record.id,
              description: deductPoints > 0
                ? `积分过期清理，扣除${deductPoints}积分`
                : '积分过期清理，当前无可用积分可扣',
            },
          });
          return true;
        });
        if (cleaned) cleanedCount++;
        else skippedCount++;
      } catch (error) {
        if ((error as any)?.code === 'P2002') {
          skippedCount++;
          continue;
        }
        const err = error as Error;
        this.logger.error(`清理过期积分失败：${record.id}，${err.message}`);
      }
    }

    this.logger.log(`清理过期积分完成，处理${cleanedCount}条，跳过${skippedCount}条`);
    return { cleanedCount, skippedCount };
  }

  private chinaDayBounds(dayOffset: number) {
    const shifted = new Date(Date.now() + CHINA_OFFSET_MS);
    const baseUtc = Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate() + dayOffset,
    );
    const start = new Date(baseUtc - CHINA_OFFSET_MS);
    const end = new Date(baseUtc + 24 * 60 * 60 * 1000 - CHINA_OFFSET_MS);
    const keyDate = new Date(baseUtc);
    const key = `${keyDate.getUTCFullYear()}-${String(keyDate.getUTCMonth() + 1).padStart(2, '0')}-${String(keyDate.getUTCDate()).padStart(2, '0')}`;
    return { start, end, key };
  }

  private createPointsExpireAt(expireMonths: number = POINTS_EXPIRE_MONTHS) {
    const now = new Date();
    const shifted = new Date(now.getTime() + CHINA_OFFSET_MS);
    shifted.setUTCMonth(shifted.getUTCMonth() + expireMonths);
    shifted.setUTCDate(shifted.getUTCDate() - 1);
    shifted.setUTCHours(23, 59, 59, 0);
    return new Date(shifted.getTime() - CHINA_OFFSET_MS);
  }
}
