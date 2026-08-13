import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
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
      select: { uploaderType: true },
    });

    // User-owned images may still be rendered by their unguessable static URL, but an
    // unauthenticated caller must not be able to enumerate sequential FileAsset ids to
    // discover profile/baby photos.
    if (file?.uploaderType === 'user') {
      throw new NotFoundException('文件不存在');
    }
    return super.findPublicById(id);
  }
}
