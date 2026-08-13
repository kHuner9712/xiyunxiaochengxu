import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { DIRECT_PROFILE_ASSET_GROUPS } from './direct-profile-asset.policy';
import { PermissionSafeUploadService } from './permission-safe-upload.service';

@Injectable()
export class ProfileSafeUploadService extends PermissionSafeUploadService {
  constructor(private readonly profilePrisma: PrismaService) {
    super(profilePrisma);
  }

  override async findPublicById(id: string) {
    const fileId = parsePositiveBigIntId(id, '文件');
    const file = await this.profilePrisma.fileAsset.findFirst({
      where: { id: fileId },
      select: { uploaderType: true, groupName: true },
    });

    // Only direct profile photos are hidden behind a generic not-found response to stop
    // sequential FileAsset id discovery. Private user uploads such as aftersale evidence must
    // continue through the base visibility contract, which returns 403 from the public endpoint.
    if (
      file?.uploaderType === 'user'
      && DIRECT_PROFILE_ASSET_GROUPS.includes(file.groupName as any)
    ) {
      throw new NotFoundException('文件不存在');
    }
    return super.findPublicById(id);
  }
}
