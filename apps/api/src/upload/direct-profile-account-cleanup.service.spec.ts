import { DirectProfileAccountCleanupService } from './direct-profile-account-cleanup.service';

describe('DirectProfileAccountCleanupService', () => {
  it('does not delete direct profile assets for an active account', async () => {
    const prisma = {
      user: { findFirst: jest.fn().mockResolvedValue(null) },
      fileAsset: { findMany: jest.fn() },
    } as any;
    const uploadService = { delete: jest.fn() } as any;
    const service = new DirectProfileAccountCleanupService(prisma, uploadService);

    await expect(service.cleanupCancelledAccount('7')).resolves.toEqual({
      scanned: 0,
      deleted: 0,
      failed: [],
    });
    expect(prisma.fileAsset.findMany).not.toHaveBeenCalled();
    expect(uploadService.delete).not.toHaveBeenCalled();
  });

  it('deletes only direct-profile assets selected for a confirmed cancelled account', async () => {
    const prisma = {
      user: { findFirst: jest.fn().mockResolvedValue({ id: 7n }) },
      fileAsset: {
        findMany: jest.fn().mockResolvedValue([
          { id: 11n, filePath: '/uploads/public/u.jpg', groupName: 'user-avatar' },
          { id: 12n, filePath: '/uploads/public/b.jpg', groupName: 'baby-avatar' },
        ]),
      },
    } as any;
    const uploadService = { delete: jest.fn().mockResolvedValue({ success: true }) } as any;
    const service = new DirectProfileAccountCleanupService(prisma, uploadService);

    await expect(service.cleanupCancelledAccount(7n)).resolves.toEqual({
      scanned: 2,
      deleted: 2,
      failed: [],
    });
    expect(prisma.fileAsset.findMany).toHaveBeenCalledWith({
      where: {
        uploaderId: 7n,
        uploaderType: 'user',
        groupName: { in: ['user-avatar', 'baby-avatar'] },
      },
      select: { id: true, filePath: true, groupName: true },
      orderBy: { id: 'asc' },
    });
    expect(uploadService.delete).toHaveBeenCalledWith('11');
    expect(uploadService.delete).toHaveBeenCalledWith('12');
  });

  it('keeps failed file assets retryable instead of hiding the failure', async () => {
    const prisma = {
      user: { findFirst: jest.fn().mockResolvedValue({ id: 7n }) },
      fileAsset: {
        findMany: jest.fn().mockResolvedValue([
          { id: 11n, filePath: '/uploads/public/u.jpg', groupName: 'user-avatar' },
        ]),
      },
    } as any;
    const uploadService = { delete: jest.fn().mockRejectedValue(new Error('disk busy')) } as any;
    const service = new DirectProfileAccountCleanupService(prisma, uploadService);

    await expect(service.cleanupCancelledAccount('7')).resolves.toEqual({
      scanned: 1,
      deleted: 0,
      failed: ['11'],
    });
  });
});
