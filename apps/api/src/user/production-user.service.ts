import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { UserService } from './user.service';

@Injectable()
export class ProductionUserService extends UserService {
  constructor(
    private readonly productionPrisma: PrismaService,
    private readonly productionRedis: RedisService,
  ) {
    super(productionPrisma);
  }

  override async toggleStatus(id: string) {
    const userId = parsePositiveBigIntId(id, '用户');

    return this.productionPrisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: bigint; status: number }>>`
        SELECT id, status
        FROM users
        WHERE id = ${userId}
          AND deleted_at IS NULL
        FOR UPDATE
      `;
      const user = rows[0];
      if (!user) throw new NotFoundException('用户不存在');

      const newStatus = user.status === 1 ? 0 : 1;
      if (newStatus === 0) {
        try {
          await this.productionRedis.delByPattern(
            `weapp_access_token:${userId.toString()}:*`,
          );
          await this.productionRedis.del(`wechat_session:${userId.toString()}`);
        } catch (error) {
          // Do not report a successful disable while revocable access sessions remain live. The
          // database transaction is intentionally left uncommitted so the operator can retry once
          // Redis is healthy instead of creating a future session-resurrection window.
          throw new InternalServerErrorException(
            `用户会话撤销失败，账号未停用：${(error as Error)?.message || 'Redis error'}`,
          );
        }
      }

      await tx.user.update({
        where: { id: userId },
        data: { status: newStatus },
      });
      return { id: userId.toString(), status: newStatus };
    });
  }
}
