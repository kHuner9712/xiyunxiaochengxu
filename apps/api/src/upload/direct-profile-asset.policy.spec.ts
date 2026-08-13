import { BadRequestException } from '@nestjs/common';
import {
  assertOwnedDirectProfileAsset,
  extractPublicUploadPath,
} from './direct-profile-asset.policy';

describe('direct profile asset policy', () => {
  it('normalizes absolute and relative public upload URLs to the stored path', () => {
    expect(extractPublicUploadPath('/uploads/public/avatar.jpg')).toBe('/uploads/public/avatar.jpg');
    expect(extractPublicUploadPath('https://api.example.com/api/uploads/public/avatar.jpg?x=1')).toBe('/uploads/public/avatar.jpg');
    expect(extractPublicUploadPath('/api/common/file/private/1')).toBeNull();
  });

  it('accepts only an asset owned by the current user in the expected group', async () => {
    const prisma = {
      fileAsset: {
        findFirst: jest.fn().mockResolvedValue({ id: 9n, filePath: '/uploads/public/avatar.jpg' }),
      },
    } as any;

    await expect(assertOwnedDirectProfileAsset(
      prisma,
      7n,
      'https://api.example.com/uploads/public/avatar.jpg',
      'user-avatar',
    )).resolves.toEqual({ id: 9n, filePath: '/uploads/public/avatar.jpg' });

    expect(prisma.fileAsset.findFirst).toHaveBeenCalledWith({
      where: {
        filePath: '/uploads/public/avatar.jpg',
        uploaderId: 7n,
        uploaderType: 'user',
        groupName: 'user-avatar',
      },
      select: { id: true, filePath: true },
    });
  });

  it('rejects unowned, wrong-purpose or non-upload avatar values', async () => {
    const prisma = {
      fileAsset: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;

    await expect(assertOwnedDirectProfileAsset(
      prisma,
      7n,
      '/uploads/public/other.jpg',
      'user-avatar',
    )).rejects.toBeInstanceOf(BadRequestException);

    await expect(assertOwnedDirectProfileAsset(
      prisma,
      7n,
      'https://external.example/avatar.jpg',
      'user-avatar',
    )).rejects.toBeInstanceOf(BadRequestException);
  });
});
