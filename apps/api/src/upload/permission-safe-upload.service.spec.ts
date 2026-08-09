import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PrismaService } from '../common/prisma/prisma.service';
import { PermissionSafeUploadService, allowedAdminPermissionsForGroup } from './permission-safe-upload.service';
import { UploadModule } from './upload.module';
import { UploadService } from './upload.service';

function createMockPrisma() {
  return {
    fileAsset: {
      findFirst: jest.fn() as any,
    },
    adminUserRole: {
      findMany: jest.fn() as any,
    },
  };
}

function activeRole(code: string, permissions: string[]) {
  return {
    role: {
      code,
      status: 1,
      adminRolePermissions: permissions.map((permission) => ({
        permission: { code: permission },
      })),
    },
  };
}

describe('PermissionSafeUploadService private-file access', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let uploadDir: string;
  let service: PermissionSafeUploadService;

  beforeEach(() => {
    uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'baby-mall-upload-auth-'));
    fs.mkdirSync(path.join(uploadDir, 'private'), { recursive: true });
    fs.writeFileSync(path.join(uploadDir, 'private', 'secret.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
    process.env.UPLOAD_DIR = uploadDir;
    prisma = createMockPrisma();
    service = new PermissionSafeUploadService(prisma as any);
  });

  afterEach(() => {
    fs.rmSync(uploadDir, { recursive: true, force: true });
    delete process.env.UPLOAD_DIR;
  });

  function privateFile(groupName = 'aftersale', uploaderId = 10n) {
    return {
      id: 1n,
      fileName: 'secret.jpg',
      originalName: 'secret.jpg',
      filePath: '/uploads/private/secret.jpg',
      fileSize: 4n,
      fileType: 'image',
      mimeType: 'image/jpeg',
      storageType: 1,
      bucket: null,
      url: null,
      groupName,
      uploaderId,
      uploaderType: 'user',
      createdAt: new Date(),
    };
  }

  it('keeps user access owner-only', async () => {
    prisma.fileAsset.findFirst.mockResolvedValue(privateFile('aftersale', 10n));
    const own = await service.findPrivateById('1', { id: '10', roleType: 'user' });
    own.stream.destroy();

    await expect(
      service.findPrivateById('1', { id: '11', roleType: 'user' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.adminUserRole.findMany).not.toHaveBeenCalled();
  });

  it('denies a generic admin that has no permission for the sensitive group', async () => {
    prisma.fileAsset.findFirst.mockResolvedValue(privateFile('aftersale'));
    prisma.adminUserRole.findMany.mockResolvedValue([
      activeRole('content_editor', ['content:list']),
    ]);

    await expect(
      service.findPrivateById('1', { id: '99', roleType: 'admin' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows aftersale operators to read aftersale private files', async () => {
    prisma.fileAsset.findFirst.mockResolvedValue(privateFile('aftersale'));
    prisma.adminUserRole.findMany.mockResolvedValue([
      activeRole('aftersale_operator', ['order:aftersale']),
    ]);

    const result = await service.findPrivateById('1', { id: '99', roleType: 'admin' });
    result.stream.destroy();
  });

  it('requires system:file for generic private/cert/admin groups while keeping super_admin bypass', async () => {
    expect(allowedAdminPermissionsForGroup('cert')).toEqual(['system:file']);
    prisma.fileAsset.findFirst.mockResolvedValue(privateFile('cert'));
    prisma.adminUserRole.findMany.mockResolvedValue([
      activeRole('file_manager', ['system:file']),
    ]);
    const fileManagerResult = await service.findPrivateById('1', { id: '99', roleType: 'admin' });
    fileManagerResult.stream.destroy();

    prisma.adminUserRole.findMany.mockResolvedValue([
      activeRole('super_admin', []),
    ]);
    const superAdminResult = await service.findPrivateById('1', { id: '99', roleType: 'admin' });
    superAdminResult.stream.destroy();
  });

  it('uses PermissionSafeUploadService as the production UploadService provider', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [UploadModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    expect(moduleRef.get(UploadService)).toBeInstanceOf(PermissionSafeUploadService);
    await moduleRef.close();
  });
});
