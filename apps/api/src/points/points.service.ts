import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { PointsQueryDto } from './dto/points-query.dto';
import { paginate, POINTS_SIGN_IN_BASE, POINTS_SIGN_IN_MAX, POINTS_DEDUCT_RATE, POINTS_DEDUCT_MAX_PERCENT, POINTS_EXPIRE_MONTHS } from '@baby-mall/shared';

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
    if (!user) return { availablePoints: 0, totalPoints: 0, frozenPoints: 0 };

    return {
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
      })),
      total,
      dto.page,
      dto.pageSize,
    );
  }

  async signIn(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existing = await this.prisma.pointsRecord.findFirst({
      where: {
        userId: BigInt(userId),
        source: 'sign_in',
        type: 1,
        createdAt: { gte: today, lt: tomorrow },
      },
    });

    if (existing) {
      return { alreadySigned: true, points: 0 };
    }

    const consecutiveDays = await this.getConsecutiveSignInDays(userId);
    const bonusPoints = Math.min(
      POINTS_SIGN_IN_BASE + consecutiveDays * 2,
      POINTS_SIGN_IN_MAX,
    );

    await this.earnPoints(userId, bonusPoints, 'sign_in', undefined, `连续签到${consecutiveDays + 1}天，奖励${bonusPoints}积分`);

    await this.redisService.set(
      `sign_in:${userId}:${today.toISOString().split('T')[0]}`,
      '1',
      86400,
    );

    this.logger.log(`用户${userId}签到，获得${bonusPoints}积分，连续${consecutiveDays + 1}天`);
    return { alreadySigned: false, points: bonusPoints, consecutiveDays: consecutiveDays + 1 };
  }

  async getSignInStatus(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todaySigned = await this.prisma.pointsRecord.findFirst({
      where: {
        userId: BigInt(userId),
        source: 'sign_in',
        type: 1,
        createdAt: { gte: today, lt: tomorrow },
      },
    });

    const consecutiveDays = await this.getConsecutiveSignInDays(userId);

    return {
      todaySigned: !!todaySigned,
      consecutiveDays,
      basePoints: POINTS_SIGN_IN_BASE,
      nextBonus: Math.min(POINTS_SIGN_IN_BASE + consecutiveDays * 2, POINTS_SIGN_IN_MAX),
    };
  }

  private async getConsecutiveSignInDays(userId: string): Promise<number> {
    let consecutiveDays = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 1; i <= 30; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const nextDate = new Date(checkDate);
      nextDate.setDate(nextDate.getDate() + 1);

      const record = await this.prisma.pointsRecord.findFirst({
        where: {
          userId: BigInt(userId),
          source: 'sign_in',
          type: 1,
          createdAt: { gte: checkDate, lt: nextDate },
        },
      });

      if (record) {
        consecutiveDays++;
      } else {
        break;
      }
    }

    return consecutiveDays;
  }

  async getRules() {
    return {
      deductRate: POINTS_DEDUCT_RATE,
      deductMaxPercent: POINTS_DEDUCT_MAX_PERCENT,
      signInBase: POINTS_SIGN_IN_BASE,
      signInMax: POINTS_SIGN_IN_MAX,
      expireMonths: POINTS_EXPIRE_MONTHS,
      description: `每${POINTS_DEDUCT_RATE}积分抵扣1元，最多抵扣订单金额的${POINTS_DEDUCT_MAX_PERCENT}%；签到每日${POINTS_SIGN_IN_BASE}积分起，连续签到递增，最高${POINTS_SIGN_IN_MAX}积分`,
    };
  }

  async earnPoints(userId: string, points: number, source: string, sourceId?: string, description?: string, expireMonths: number = POINTS_EXPIRE_MONTHS) {
    const user = await this.prisma.user.findFirst({ where: { id: BigInt(userId) } });
    if (!user) return;

    const newBalance = user.availablePoints + points;
    const expireAt = new Date();
    expireAt.setMonth(expireAt.getMonth() + expireMonths);
    expireAt.setMonth(11, 31);
    expireAt.setHours(23, 59, 59, 0);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: BigInt(userId) },
        data: {
          totalPoints: { increment: points },
          availablePoints: { increment: points },
        },
      }),
      this.prisma.pointsRecord.create({
        data: {
          userId: BigInt(userId),
          type: 1,
          points,
          balance: newBalance,
          source,
          sourceId: sourceId ? BigInt(sourceId) : null,
          description,
          expireAt,
        },
      }),
    ]);
  }

  async consumePoints(userId: string, points: number, source: string, sourceId?: string, description?: string) {
    const user = await this.prisma.user.findFirst({ where: { id: BigInt(userId) } });
    if (!user || user.availablePoints < points) return;

    const newBalance = user.availablePoints - points;

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: BigInt(userId) },
        data: { availablePoints: { decrement: points } },
      }),
      this.prisma.pointsRecord.create({
        data: {
          userId: BigInt(userId),
          type: 2,
          points,
          balance: newBalance,
          source,
          sourceId: sourceId ? BigInt(sourceId) : null,
          description,
        },
      }),
    ]);
  }

  async adminAdjust(userId: string, points: number, description: string) {
    if (points > 0) {
      await this.earnPoints(userId, points, 'admin_adjust', undefined, description);
    } else {
      await this.consumePoints(userId, Math.abs(points), 'admin_adjust', undefined, description);
    }
    this.logger.log(`管理员调整用户${userId}积分：${points}`);
    return { success: true };
  }

  async cleanExpiredPoints() {
    const now = new Date();
    const expiredRecords = await this.prisma.pointsRecord.findMany({
      where: {
        type: 1,
        expireAt: { lte: now },
      },
      take: 1000,
    });

    let cleanedCount = 0;
    for (const record of expiredRecords) {
      try {
        const user = await this.prisma.user.findFirst({ where: { id: record.userId } });
        if (!user) continue;

        const deductPoints = Math.min(record.points, user.availablePoints);
        if (deductPoints > 0) {
          await this.prisma.$transaction([
            this.prisma.user.update({
              where: { id: record.userId },
              data: { availablePoints: { decrement: deductPoints } },
            }),
            this.prisma.pointsRecord.create({
              data: {
                userId: record.userId,
                type: 3,
                points: deductPoints,
                balance: user.availablePoints - deductPoints,
                source: 'expire',
                description: `积分过期清理，扣除${deductPoints}积分`,
              },
            }),
          ]);
          cleanedCount++;
        }
      } catch (error) {
        const err = error as Error;
        this.logger.error(`清理过期积分失败：${record.id}，${err.message}`);
      }
    }

    this.logger.log(`清理过期积分完成，共${cleanedCount}条`);
    return { cleanedCount };
  }
}
