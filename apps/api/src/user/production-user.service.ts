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

      // Revoke sessions on both transitions. During a disable transaction, a concurrent login can
      // still observe the last committed active row before this transaction commits and create a
      // fresh Redis access key after the first revocation pass. The DB status keeps that key unusable
      // while disabled, and revoking again before a later re-enable prevents that stale key from ever
      // becoming valid again.
      try {
        await this.productionRedis.delByPattern(
          `weapp_access_token:${userId.toString()}:*`,
        );
        await this.productionRedis.del(`wechat_session:${userId.toString()}`);
      } catch (error) {
        throw new InternalServerErrorException(
          `用户会话撤销失败，账号状态未变更：${(error as Error)?.message || 'Redis error'}`,
        );
      }

      await tx.user.update({
        where: { id: userId },
        data: { status: newStatus },
      });
      return { id: userId.toString(), status: newStatus };
    });
  }
}
