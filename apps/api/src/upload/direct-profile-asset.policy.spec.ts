import { BadRequestException } from '@nestjs/common';
import {
  assertOwnedDirectProfileAsset,
  extractPublicUploadPath,
} from './direct-profile-asset.policy';

describe('direct profile asset policy', () => {
  const previousUploadPublicUrl = process.env.UPLOAD_PUBLIC_URL;

  afterEach(() => {
    if (previousUploadPublicUrl === undefined) delete process.env.UPLOAD_PUBLIC_URL;
    else process.env.UPLOAD_PUBLIC_URL = previousUploadPublicUrl;
  });

  it('normalizes absolute and relative public upload URLs to the stored path', () => {
    process.env.UPLOAD_PUBLIC_URL = 'https://api.example.com';
    expect(extractPublicUploadPath('/uploads/public/avatar.jpg')).toBe('/uploads/public/avatar.jpg');
    expect(extractPublicUploadPath('https://api.example.com/api/uploads/public/avatar.jpg?x=1')).toBe('/uploads/public/avatar.jpg');
    expect(extractPublicUploadPath('/api/common/file/private/1')).toBeNull();
  });

  it('accepts only an asset owned by the current user in the expected group', async () => {
    process.env.UPLOAD_PUBLIC_URL = 'https://api.example.com';
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

  it('rejects a third-party absolute origin even when its pathname mimics an owned upload', async () => {
    process.env.UPLOAD_PUBLIC_URL = 'https://api.example.com';
    const prisma = {
      fileAsset: { findFirst: jest.fn() },
    } as any;

    await expect(assertOwnedDirectProfileAsset(
      prisma,
      7n,
      'https://evil.example/uploads/public/avatar.jpg',
      'user-avatar',
    )).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.fileAsset.findFirst).not.toHaveBeenCalled();
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
