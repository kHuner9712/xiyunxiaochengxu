import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { POINTS_EXPIRE_MONTHS } from '@baby-mall/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';

const MYSQL_SIGNED_INT_MAX = 2_147_483_647;
const MYSQL_SIGNED_BIGINT_MAX = 9_223_372_036_854_775_807n;
const ADMIN_ADJUST_SOURCE = 'admin_adjust';
const CHINA_OFFSET_MS = 8 * 60 * 60 * 1000;

@Injectable()
export class AdminPointsAdjustmentService {
  private readonly logger = new Logger(AdminPointsAdjustmentService.name);

  constructor(private readonly prisma: PrismaService) {}

  async adjust(
    userIdInput: string,
    points: number,
    description: string,
    expectedAvailablePoints: number,
    requestIdInput: string,
  ) {
    const userId = parsePositiveBigIntId(userIdInput, '用户');
    const requestId = parsePositiveBigIntId(requestIdInput, '积分调整请求');
    if (requestId > MYSQL_SIGNED_BIGINT_MAX) {
      throw new BadRequestException('积分调整请求ID超出范围');
    }
    if (!Number.isSafeInteger(points) || points === 0) {
      throw new BadRequestException('调整积分必须为非零整数');
    }
    if (!Number.isSafeInteger(expectedAvailablePoints) || expectedAvailablePoints < 0) {
      throw new BadRequestException('当前积分版本无效，请刷新用户列表后重试');
    }
    const cleanDescription = typeof description === 'string' ? description.trim() : '';
    if (!cleanDescription) throw new BadRequestException('请填写积分调整原因');

    let result: {
      success: true;
      replayed: boolean;
      userId: string;
      beforeAvailablePoints: number;
      afterAvailablePoints: number;
    };

    try {
      result = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} AND deleted_at IS NULL FOR UPDATE`;
        const user = await tx.user.findFirst({
          where: { id: userId, deletedAt: null },
          select: { id: true, availablePoints: true, totalPoints: true },
        });
        if (!user) throw new NotFoundException('用户不存在');

        // The row lock serializes retries for the same user. Query the durable request fact only
        // after that lock: a concurrent first attempt must be allowed to commit its PointsRecord
        // before a retry decides whether this is a replay or a new mutation.
        const existing = await tx.pointsRecord.findFirst({
          where: { source: ADMIN_ADJUST_SOURCE, sourceId: requestId },
          select: {
            userId: true,
            type: true,
            points: true,
            balance: true,
            description: true,
          },
        });
        if (existing) {
          const expectedType = points > 0 ? 1 : 2;
          const expectedPoints = Math.abs(points);
          if (
            existing.userId !== user.id ||
            existing.type !== expectedType ||
            existing.points !== expectedPoints ||
            (existing.description || '') !== cleanDescription ||
            existing.balance === null
          ) {
            throw new BadRequestException('积分调整请求ID已被其他操作使用，请重新打开调整弹窗后重试');
          }

          const afterAvailablePoints = existing.balance;
          const beforeAvailablePoints = points > 0
            ? afterAvailablePoints - points
            : afterAvailablePoints + expectedPoints;
          return {
            success: true as const,
            replayed: true,
            userId: user.id.toString(),
            beforeAvailablePoints,
            afterAvailablePoints,
          };
        }

        // The rendered balance remains an optimistic-concurrency guard for genuinely new actions.
        // Durable request identity above closes the ABA/retry hole that a balance value alone cannot.
        if (user.availablePoints !== expectedAvailablePoints) {
          throw new BadRequestException(
            `用户积分已变更（当前可用 ${user.availablePoints}），请刷新确认上次操作是否已生效后再重试`,
          );
        }

        const nextAvailablePoints = user.availablePoints + points;
        if (
          !Number.isSafeInteger(nextAvailablePoints) ||
          nextAvailablePoints < 0 ||
          nextAvailablePoints > MYSQL_SIGNED_INT_MAX
        ) {
          throw new BadRequestException(`调整后的可用积分必须在0-${MYSQL_SIGNED_INT_MAX}之间`);
        }

        const nextTotalPoints = points > 0 ? user.totalPoints + points : user.totalPoints;
        if (
          !Number.isSafeInteger(nextTotalPoints) ||
          nextTotalPoints < 0 ||
          nextTotalPoints > MYSQL_SIGNED_INT_MAX
        ) {
          throw new BadRequestException(`调整后的累计积分必须在0-${MYSQL_SIGNED_INT_MAX}之间`);
        }

        await tx.user.update({
          where: { id: user.id },
          data: points > 0
            ? {
                totalPoints: { increment: points },
                availablePoints: { increment: points },
              }
            : {
                availablePoints: { decrement: Math.abs(points) },
              },
        });

        await tx.pointsRecord.create({
          data: {
            userId: user.id,
            type: points > 0 ? 1 : 2,
            points: Math.abs(points),
            balance: nextAvailablePoints,
            source: ADMIN_ADJUST_SOURCE,
            sourceId: requestId,
            description: cleanDescription,
            ...(points > 0 ? { expireAt: this.createPointsExpireAt() } : {}),
          },
        });

        return {
          success: true as const,
          replayed: false,
          userId: user.id.toString(),
          beforeAvailablePoints: user.availablePoints,
          afterAvailablePoints: nextAvailablePoints,
        };
      });
    } catch (error) {
      // The unique (source, sourceId) index is the last line of defence for the extremely rare case
      // where the same request ID reaches different user-row locks concurrently. The losing
      // transaction is rolled back in full, so no balance/ledger split is possible.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException('积分调整请求ID冲突，请重新打开调整弹窗后重试');
      }
      throw error;
    }

    this.logger.log(
      `管理员调整用户${userId.toString()}积分：${points}, requestId=${requestId.toString()}, replayed=${result.replayed}`,
    );
    return result;
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
