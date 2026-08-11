import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';

@Injectable()
export class UserStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async setStatus(id: string, targetStatus: number) {
    const userId = parsePositiveBigIntId(id, '用户');
    if (targetStatus !== 0 && targetStatus !== 1) {
      throw new BadRequestException('用户状态只能为0或1');
    }

    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: bigint; status: number }>>`
        SELECT id, status
        FROM users
        WHERE id = ${userId}
          AND deleted_at IS NULL
        FOR UPDATE
      `;
      const user = rows[0];
      if (!user) throw new NotFoundException('用户不存在');

      // Explicit target state makes retry-after-timeout idempotent. A request that already committed
      // must never toggle the account back to the opposite state when the administrator retries it.
      if (user.status === targetStatus) {
        return { id: userId.toString(), status: targetStatus };
      }

      // Revoke on both transitions. A login racing with disable may create a Redis token against the
      // previously committed active row; while disabled the DB guard keeps it unusable, and the next
      // explicit enable transition revokes again before the account becomes active.
      try {
        await this.redis.delByPattern(`weapp_access_token:${userId.toString()}:*`);
        await this.redis.del(`wechat_session:${userId.toString()}`);
      } catch (error) {
        throw new InternalServerErrorException(
          `用户会话撤销失败，账号状态未变更：${(error as Error)?.message || 'Redis error'}`,
        );
      }

      await tx.user.update({
        where: { id: userId },
        data: { status: targetStatus },
      });
      return { id: userId.toString(), status: targetStatus };
    });
  }
}
