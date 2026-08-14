import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { DIRECT_PROFILE_ASSET_GROUPS } from './direct-profile-asset.policy';
import { UploadService } from './upload.service';

type CleanupAsset = {
  id: bigint;
  filePath: string;
  groupName: string | null;
};

export type DirectProfileCleanupResult = {
  scanned: number;
  deleted: number;
  failed: string[];
};

@Injectable()
export class DirectProfileAccountCleanupService {
  private readonly logger = new Logger(DirectProfileAccountCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadService: UploadService,
  ) {}

  async cleanupCancelledAccount(userId: string | bigint): Promise<DirectProfileCleanupResult> {
    const parsedUserId = typeof userId === 'bigint'
      ? userId
      : parsePositiveBigIntId(userId, '用户');

    // Never allow this cleanup primitive to delete profile images for an active account,
    // even if a caller wires it incorrectly in the future.
    const cancelledUser = await this.prisma.user.findFirst({
      where: { id: parsedUserId, deletedAt: { not: null } },
      select: { id: true },
    });
    if (!cancelledUser) return { scanned: 0, deleted: 0, failed: [] };

    const assets = await this.prisma.fileAsset.findMany({
      where: {
        uploaderId: parsedUserId,
        uploaderType: 'user',
        groupName: { in: [...DIRECT_PROFILE_ASSET_GROUPS] },
      },
      select: { id: true, filePath: true, groupName: true },
      orderBy: { id: 'asc' },
    });

    return this.deleteAssets(parsedUserId, assets);
  }

  async cleanupCancelledAccountsBatch(limit = 200): Promise<DirectProfileCleanupResult> {
    const take = Math.max(1, Math.min(1000, Math.trunc(limit)));
    const assets = await this.prisma.$queryRaw<Array<CleanupAsset & { uploaderId: bigint }>>`
      SELECT
        f.id,
        f.file_path AS filePath,
        f.group_name AS groupName,
        f.uploader_id AS uploaderId
      FROM file_assets f
      INNER JOIN users u ON u.id = f.uploader_id
      WHERE f.uploader_type = 'user'
        AND f.group_name IN ('user-avatar', 'baby-avatar')
        AND u.deleted_at IS NOT NULL
      ORDER BY f.id ASC
      LIMIT ${take}
    `;

    let deleted = 0;
    const failed: string[] = [];
    for (const asset of assets) {
      try {
        await this.uploadService.delete(asset.id.toString());
        deleted += 1;
      } catch (error) {
        failed.push(asset.id.toString());
        this.logger.error(
          `已注销账号直接资料图片补偿清理失败: userId=${asset.uploaderId.toString()} assetId=${asset.id.toString()} path=${asset.filePath} error=${(error as Error)?.message || error}`,
        );
      }
    }
    return { scanned: assets.length, deleted, failed };
  }

  private async deleteAssets(
    userId: bigint,
    assets: CleanupAsset[],
  ): Promise<DirectProfileCleanupResult> {
    let deleted = 0;
    const failed: string[] = [];
    for (const asset of assets) {
      try {
        await this.uploadService.delete(asset.id.toString());
        deleted += 1;
      } catch (error) {
        failed.push(asset.id.toString());
        this.logger.error(
          `注销账号直接资料图片清理失败: userId=${userId.toString()} assetId=${asset.id.toString()} path=${asset.filePath} error=${(error as Error)?.message || error}`,
        );
      }
    }
    return { scanned: assets.length, deleted, failed };
  }
}
