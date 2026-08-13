import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { DIRECT_PROFILE_ASSET_GROUPS } from './direct-profile-asset.policy';
import { UploadService } from './upload.service';

@Injectable()
export class DirectProfileAccountCleanupService {
  private readonly logger = new Logger(DirectProfileAccountCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadService: UploadService,
  ) {}

  async cleanupCancelledAccount(userId: string | bigint) {
    const parsedUserId = typeof userId === 'bigint'
      ? userId
      : parsePositiveBigIntId(userId, '用户');
    const assets = await this.prisma.fileAsset.findMany({
      where: {
        uploaderId: parsedUserId,
        uploaderType: 'user',
        groupName: { in: [...DIRECT_PROFILE_ASSET_GROUPS] },
      },
      select: { id: true, filePath: true, groupName: true },
      orderBy: { id: 'asc' },
    });

    let deleted = 0;
    const failed: string[] = [];
    for (const asset of assets) {
      try {
        await this.uploadService.delete(asset.id.toString());
        deleted += 1;
      } catch (error) {
        failed.push(asset.id.toString());
        this.logger.error(
          `注销账号直接资料图片清理失败: userId=${parsedUserId.toString()} assetId=${asset.id.toString()} path=${asset.filePath} error=${(error as Error)?.message || error}`,
        );
      }
    }

    return { scanned: assets.length, deleted, failed };
  }
}
