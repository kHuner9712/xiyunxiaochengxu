import fs from 'node:fs';
import path from 'node:path';
import { BadRequestException } from '@nestjs/common';
import { ProfileAssetSafeBabyProfileService } from './profile-asset-safe-baby-profile.service';

const repoRoot = path.resolve(__dirname, '../../../..');

describe('ProfileAssetSafeBabyProfileService', () => {
  it('rejects an unowned image before entering the profile create transaction', async () => {
    const prisma = {
      fileAsset: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(),
    } as any;
    const service = new ProfileAssetSafeBabyProfileService(prisma);

    await expect(service.create('7', {
      birthday: '2025-01-01',
      avatar: '/uploads/public/not-owned.jpg',
    })).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.fileAsset.findFirst).toHaveBeenCalledWith({
      where: {
        filePath: '/uploads/public/not-owned.jpg',
        uploaderId: 7n,
        uploaderType: 'user',
        groupName: 'baby-avatar',
      },
      select: { id: true, filePath: true },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('is the runtime implementation bound to BabyProfileService', () => {
    const moduleSource = fs.readFileSync(
      path.join(repoRoot, 'apps/api/src/baby-profile/baby-profile.module.ts'),
      'utf8',
    );
    expect(moduleSource).toContain('ProfileAssetSafeBabyProfileService');
    expect(moduleSource).toContain('provide: BabyProfileService');
    expect(moduleSource).toContain('useExisting: ProfileAssetSafeBabyProfileService');
  });
});
