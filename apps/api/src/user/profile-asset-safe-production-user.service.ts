import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { assertOwnedDirectProfileAsset } from '../upload/direct-profile-asset.policy';
import { DirectProfileAccountCleanupService } from '../upload/direct-profile-account-cleanup.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProductionUserService } from './production-user.service';

@Injectable()
export class ProfileAssetSafeProductionUserService extends ProductionUserService {
  private readonly profileLogger = new Logger(ProfileAssetSafeProductionUserService.name);

  constructor(
    private readonly profilePrisma: PrismaService,
    redisService: RedisService,
    private readonly profileCleanupService: DirectProfileAccountCleanupService,
  ) {
    super(profilePrisma, redisService);
  }

  override async updateProfile(userId: string, dto: UpdateProfileDto) {
    const parsedUserId = parsePositiveBigIntId(userId, '用户');
    const current = await this.profilePrisma.user.findFirst({
      where: { id: parsedUserId, deletedAt: null },
      select: { avatarUrl: true },
    });

    const suppliedAvatar = dto.avatarUrl ?? dto.avatar;
    if (current && suppliedAvatar !== undefined) {
      const nextAvatar = suppliedAvatar.trim();
      const currentAvatar = String(current.avatarUrl || '').trim();
      if (nextAvatar && nextAvatar !== currentAvatar) {
        await assertOwnedDirectProfileAsset(
          this.profilePrisma,
          parsedUserId,
          nextAvatar,
          'user-avatar',
        );
      }
    }

    return super.updateProfile(userId, dto);
  }

  override async cancelAccount(id: string) {
    const result = await super.cancelAccount(id);

    // The durable cancellation transaction has already committed. Storage cleanup must not turn a
    // completed cancellation into a false client-visible failure; deleted-user facts remain durable
    // and are retried by the scheduled compensator if this immediate attempt cannot finish.
    try {
      const cleanup = await this.profileCleanupService.cleanupCancelledAccount(id);
      if (cleanup.failed.length > 0) {
        this.profileLogger.error(
          `账号注销已完成，但直接资料图片仍需补偿清理: userId=${id} failed=${cleanup.failed.join(',')}`,
        );
      }
    } catch (error) {
      this.profileLogger.error(
        `账号注销已完成，但直接资料图片即时清理任务异常: userId=${id} error=${(error as Error)?.message || error}`,
      );
    }

    return result;
  }
}
