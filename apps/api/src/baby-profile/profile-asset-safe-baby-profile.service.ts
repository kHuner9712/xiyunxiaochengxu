import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { assertOwnedDirectProfileAsset } from '../upload/direct-profile-asset.policy';
import { BabyProfileService } from './baby-profile.service';
import { CreateBabyProfileDto, UpdateBabyProfileDto } from './dto/create-baby-profile.dto';

@Injectable()
export class ProfileAssetSafeBabyProfileService extends BabyProfileService {
  constructor(private readonly profilePrisma: PrismaService) {
    super(profilePrisma);
  }

  override async create(userId: string, data: CreateBabyProfileDto) {
    const parsedUserId = parsePositiveBigIntId(userId, '用户');
    const suppliedImage = data.avatarUrl ?? data.avatar;
    const nextImage = suppliedImage?.trim() || '';
    if (nextImage) {
      await assertOwnedDirectProfileAsset(
        this.profilePrisma,
        parsedUserId,
        nextImage,
        'baby-avatar',
      );
    }
    return super.create(userId, data);
  }

  override async update(userId: string, id: string, data: UpdateBabyProfileDto) {
    const parsedUserId = parsePositiveBigIntId(userId, '用户');
    const profileId = parsePositiveBigIntId(id, '档案');
    const suppliedImage = data.avatarUrl ?? data.avatar;

    if (suppliedImage !== undefined) {
      const current = await this.profilePrisma.babyProfile.findFirst({
        where: { id: profileId, userId: parsedUserId, deletedAt: null },
        select: { avatarUrl: true },
      });
      const nextImage = suppliedImage.trim();
      const currentImage = String(current?.avatarUrl || '').trim();
      if (nextImage && nextImage !== currentImage) {
        await assertOwnedDirectProfileAsset(
          this.profilePrisma,
          parsedUserId,
          nextImage,
          'baby-avatar',
        );
      }
    }

    return super.update(userId, id, data);
  }
}
