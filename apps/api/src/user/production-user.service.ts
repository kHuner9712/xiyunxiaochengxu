import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AftersaleStatus, OrderStatus } from '@prisma/client';
import { AFTERSALE_APPLY_DAYS } from '@baby-mall/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { REFUND_STATUS } from '../common/constants';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { UserService } from './user.service';

@Injectable()
export class ProductionUserService extends UserService {
  private readonly productionLogger = new Logger(ProductionUserService.name);

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

  async cancelAccount(id: string) {
    const userId = parsePositiveBigIntId(id, '用户');
    const rawApplyDays = await this.productionPrisma.systemConfig.findFirst({
      where: { groupName: 'order', configKey: 'aftersale_apply_days' },
      select: { configValue: true },
    });
    const parsedApplyDays = Number.parseInt(rawApplyDays?.configValue || '', 10);
    const aftersaleApplyDays = Number.isSafeInteger(parsedApplyDays) && parsedApplyDays >= 1 && parsedApplyDays <= 365
      ? parsedApplyDays
      : AFTERSALE_APPLY_DAYS;
    const aftersaleCutoff = new Date(Date.now() - aftersaleApplyDays * 24 * 60 * 60 * 1000);

    const result = await this.productionPrisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: bigint; status: number }>>`
        SELECT id, status
        FROM users
        WHERE id = ${userId}
          AND deleted_at IS NULL
        FOR UPDATE
      `;
      const user = rows[0];
      if (!user) throw new NotFoundException('用户不存在或账号已注销');

      const [blockingOrder, activeAftersale, activeRefund] = await Promise.all([
        tx.order.findFirst({
          where: {
            userId,
            OR: [
              { status: { notIn: [OrderStatus.cancelled, OrderStatus.completed] } },
              {
                status: OrderStatus.completed,
                OR: [
                  { completedAt: null },
                  { completedAt: { gt: aftersaleCutoff } },
                ],
              },
            ],
          },
          select: { id: true, orderNo: true, status: true },
        }),
        tx.aftersaleOrder.findFirst({
          where: {
            userId,
            status: {
              in: [
                AftersaleStatus.pending_review,
                AftersaleStatus.approved,
                AftersaleStatus.returned,
                AftersaleStatus.pending_refund,
              ],
            },
          },
          select: { id: true, aftersaleNo: true, status: true },
        }),
        tx.orderRefund.findFirst({
          where: {
            order: { userId },
            status: {
              in: [
                REFUND_STATUS.INITIATING,
                REFUND_STATUS.PENDING,
                REFUND_STATUS.PROCESSING,
                REFUND_STATUS.FAILED,
                REFUND_STATUS.RETRYING,
                REFUND_STATUS.ABNORMAL,
              ],
            },
          },
          select: { id: true, outRefundNo: true, status: true },
        }),
      ]);

      if (blockingOrder) {
        throw new BadRequestException(
          `存在未完成订单或仍在${aftersaleApplyDays}天售后期内的订单（${blockingOrder.orderNo}），请完成订单/售后期后再注销账号`,
        );
      }
      if (activeAftersale) {
        throw new BadRequestException(
          `存在处理中售后单（${activeAftersale.aftersaleNo}），请等待售后完成后再注销账号`,
        );
      }
      if (activeRefund) {
        throw new BadRequestException(
          `存在未收敛退款（${activeRefund.outRefundNo}），请等待退款处理完成后再注销账号`,
        );
      }

      // Revoke before committing the destructive identity transition. If Redis is unavailable we
      // keep the durable account unchanged rather than reporting a cancellation with live sessions.
      try {
        await this.productionRedis.delByPattern(`weapp_access_token:${userId.toString()}:*`);
        await this.productionRedis.del(`wechat_session:${userId.toString()}`);
      } catch (error) {
        throw new InternalServerErrorException(
          `账号注销前会话撤销失败，账号未注销：${(error as Error)?.message || 'Redis error'}`,
        );
      }

      // Historical orders/refunds remain attached to this anonymized ledger identity so financial,
      // fulfillment and dispute records are not corrupted. Direct profile/address/baby/cart PII is
      // removed and the unique WeChat openid is replaced, allowing a future fresh registration.
      await tx.cart.deleteMany({ where: { userId } });
      await tx.userAddress.deleteMany({ where: { userId } });
      await tx.babyProfile.deleteMany({ where: { userId } });
      await tx.userProfile.deleteMany({ where: { userId } });

      const cancelledAt = new Date();
      const tombstoneOpenid = `deleted_${userId.toString()}_${cancelledAt.getTime().toString(36)}`;
      await tx.user.update({
        where: { id: userId },
        data: {
          openid: tombstoneOpenid,
          unionId: null,
          phone: null,
          nickname: null,
          avatarUrl: null,
          gender: 0,
          memberLevelId: null,
          growthValue: 0,
          totalPoints: 0,
          availablePoints: 0,
          status: 0,
          lastLoginAt: null,
          deletedAt: cancelledAt,
        },
      });

      return { cancelled: true, cancelledAt };
    });

    // A login that started immediately before the row lock may have written a Redis key after the
    // first revocation. The deleted DB row already makes that token unusable; this second pass removes
    // the stale key as well. A cleanup failure is logged but does not roll back a completed erasure.
    try {
      await this.productionRedis.delByPattern(`weapp_access_token:${userId.toString()}:*`);
      await this.productionRedis.del(`wechat_session:${userId.toString()}`);
    } catch (error) {
      this.productionLogger.error(
        `账号已注销，但注销后的 Redis 会话清理失败: userId=${userId.toString()} error=${(error as Error)?.message || error}`,
      );
    }

    this.productionLogger.log(`用户账号已注销并匿名化: userId=${userId.toString()}`);
    return result;
  }
}
