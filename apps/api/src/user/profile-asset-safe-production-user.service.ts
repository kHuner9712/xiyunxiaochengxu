import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { assertOwnedDirectProfileAsset } from '../upload/direct-profile-asset.policy';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProductionUserService } from './production-user.service';

@Injectable()
export class ProfileAssetSafeProductionUserService extends ProductionUserService {
  constructor(
    private readonly profilePrisma: PrismaService,
    redisService: RedisService,
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
}
