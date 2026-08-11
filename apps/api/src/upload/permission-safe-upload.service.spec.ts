import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { ReadStream } from 'fs';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  PermissionSafeUploadService,
  allowedAdminPermissionsForGroup,
  allowedAdminUploadPermissionsForGroup,
  USER_PRIVATE_UPLOAD_GROUPS,
  USER_PUBLIC_UPLOAD_GROUPS,
} from './permission-safe-upload.service';
import { UploadModule } from './upload.module';
import { UploadService } from './upload.service';

function createMockPrisma() {
  return {
    fileAsset: {
      findFirst: jest.fn() as any,
      create: jest.fn() as any,
    },
    adminUserRole: {
      findMany: jest.fn() as any,
    },
    aftersaleOrder: {
      findFirst: jest.fn() as any,
    },
    product: {
      findFirst: jest.fn() as any,
    },
    supplier: {
      findFirst: jest.fn() as any,
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

async function openAndClose(stream: ReadStream) {
  await new Promise<void>((resolve, reject) => {
    stream.once('error', reject);
    stream.once('close', resolve);
    stream.once('open', () => stream.destroy());
  });
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

  function privateFile(
    groupName = 'aftersale',
    uploaderId = 10n,
    uploaderType = 'user',
  ) {
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
      uploaderType,
      createdAt: new Date(),
    };
  }

  function jpegUpload(size = 4): Express.Multer.File {
    const buffer = size === 4
      ? Buffer.from([0xff, 0xd8, 0xff, 0xd9])
      : Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(size - 3)]);
    return {
      fieldname: 'file',
      originalname: 'avatar.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      size,
      buffer,
      destination: '',
      filename: '',
      path: '',
      stream: undefined as any,
    };
  }

  it('keeps user access owner-only', async () => {
    prisma.fileAsset.findFirst.mockResolvedValue(privateFile('aftersale', 10n));
    const own = await service.findPrivateById('1', { id: '10', roleType: 'user' });
    await openAndClose(own.stream);

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

  it('requires an aftersale business reference even when the admin has aftersale permission', async () => {
    prisma.fileAsset.findFirst.mockResolvedValue(privateFile('aftersale'));
    prisma.adminUserRole.findMany.mockResolvedValue([
      activeRole('aftersale_operator', ['order:aftersale']),
    ]);
    prisma.aftersaleOrder.findFirst.mockResolvedValue(null);

    await expect(
      service.findPrivateById('1', { id: '99', roleType: 'admin' }),
    ).rejects.toThrow('尚未进入可访问的业务记录');
    expect(prisma.aftersaleOrder.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        images: {
          array_contains: '/api/common/file/private/1',
        },
      },
    }));
  });

  it('allows aftersale operators to read aftersale private files only after business reference', async () => {
    prisma.fileAsset.findFirst.mockResolvedValue(privateFile('aftersale'));
    prisma.adminUserRole.findMany.mockResolvedValue([
      activeRole('aftersale_operator', ['order:aftersale']),
    ]);
    prisma.aftersaleOrder.findFirst.mockResolvedValue({ id: 7n });

    const result = await service.findPrivateById('1', { id: '99', roleType: 'admin' });
    await openAndClose(result.stream);
  });

  it('requires a supplier business reference for supplier access to business licenses', async () => {
    prisma.fileAsset.findFirst.mockResolvedValue(privateFile('business_license'));
    prisma.adminUserRole.findMany.mockResolvedValue([
      activeRole('supplier_operator', ['supplier:list']),
    ]);
    prisma.supplier.findFirst.mockResolvedValue({ id: 8n });

    const result = await service.findPrivateById('1', { id: '99', roleType: 'admin' });
    await openAndClose(result.stream);
    expect(prisma.supplier.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        businessLicense: '/api/common/file/private/1',
        deletedAt: null,
      },
    }));
  });

  it('lets product editors preview only their own unreferenced cert uploads', async () => {
    expect(allowedAdminPermissionsForGroup('cert')).toEqual([
      'product:create',
      'product:edit',
      'system:file',
    ]);
    prisma.fileAsset.findFirst.mockResolvedValue(privateFile('cert', 99n, 'admin'));
    prisma.adminUserRole.findMany.mockResolvedValue([
      activeRole('product_editor', ['product:edit']),
    ]);

    const own = await service.findPrivateById('1', { id: '99', roleType: 'admin' });
    await openAndClose(own.stream);
    expect(prisma.product.findFirst).not.toHaveBeenCalled();

    prisma.fileAsset.findFirst.mockResolvedValue(privateFile('cert', 98n, 'admin'));
    prisma.product.findFirst.mockResolvedValue(null);
    await expect(
      service.findPrivateById('1', { id: '99', roleType: 'admin' }),
    ).rejects.toThrow('尚未进入可访问的业务记录');
  });

  it('allows another product editor to read certs only after product reference', async () => {
    prisma.fileAsset.findFirst.mockResolvedValue(privateFile('cert', 98n, 'admin'));
    prisma.adminUserRole.findMany.mockResolvedValue([
      activeRole('product_editor', ['product:edit']),
    ]);
    prisma.product.findFirst.mockResolvedValue({ id: 18n });

    const result = await service.findPrivateById('1', { id: '99', roleType: 'admin' });
    await openAndClose(result.stream);
    expect(prisma.product.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        deletedAt: null,
        attributes: {
          path: '$.compliance.certImages',
          array_contains: '/api/common/file/private/1',
        },
      },
    }));
  });

  it('keeps generic private/admin groups system:file-only while preserving super_admin bypass', async () => {
    expect(allowedAdminPermissionsForGroup('private')).toEqual(['system:file']);
    prisma.fileAsset.findFirst.mockResolvedValue(privateFile('private'));
    prisma.adminUserRole.findMany.mockResolvedValue([
      activeRole('file_manager', ['system:file']),
    ]);
    const fileManagerResult = await service.findPrivateById('1', { id: '99', roleType: 'admin' });
    await openAndClose(fileManagerResult.stream);

    prisma.adminUserRole.findMany.mockResolvedValue([
      activeRole('super_admin', []),
    ]);
    const superAdminResult = await service.findPrivateById('1', { id: '99', roleType: 'admin' });
    await openAndClose(superAdminResult.stream);
  });

  it('maps business upload groups to least-privilege permissions', () => {
    expect(allowedAdminUploadPermissionsForGroup('product-image')).toEqual([
      'product:create',
      'product:edit',
      'system:file',
    ]);
    expect(allowedAdminUploadPermissionsForGroup('brand-logo')).toEqual([
      'product:brand',
      'system:file',
    ]);
    expect(allowedAdminUploadPermissionsForGroup('content-cover')).toEqual([
      'content:edit',
      'system:file',
    ]);
    expect(allowedAdminUploadPermissionsForGroup('customer-service')).toEqual([
      'system:customer-service',
      'system:file',
    ]);
    expect(allowedAdminUploadPermissionsForGroup('unknown')).toEqual(['system:file']);
  });

  it('allows only matching business admins to upload a business group', async () => {
    prisma.fileAsset.create.mockImplementation(async ({ data }: any) => ({
      id: 3n,
      ...data,
      createdAt: new Date(),
    }));
    prisma.adminUserRole.findMany.mockResolvedValue([
      activeRole('product_editor', ['product:edit']),
    ]);

    const uploaded = await service.uploadFile(jpegUpload(), '99', 'admin', 'product-image');
    expect(uploaded.groupName).toBe('product-image');

    await expect(
      service.uploadFile(jpegUpload(), '99', 'admin', 'marketing-banner'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('only permits explicit user upload purposes and image content', async () => {
    expect([...USER_PUBLIC_UPLOAD_GROUPS]).toEqual(expect.arrayContaining(['user-avatar', 'baby-avatar']));
    expect([...USER_PRIVATE_UPLOAD_GROUPS]).toContain('aftersale');

    await expect(service.uploadFile(jpegUpload(), '10', 'user')).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.uploadFile(jpegUpload(), '10', 'user', 'content-cover'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.uploadFile(
        { ...jpegUpload(), originalname: 'avatar.mp4', mimetype: 'video/mp4' },
        '10',
        'user',
        'user-avatar',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.uploadFile(jpegUpload(10 * 1024 * 1024 + 1), '10', 'user', 'user-avatar'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps public avatar uploads and private aftersale uploads functional', async () => {
    prisma.fileAsset.create.mockImplementation(async ({ data }: any) => ({
      id: data.groupName === 'aftersale' ? 2n : 1n,
      ...data,
      createdAt: new Date(),
    }));

    const avatar = await service.uploadFile(jpegUpload(), '10', 'user', 'baby-avatar');
    expect(avatar.groupName).toBe('baby-avatar');
    expect(avatar.url).toMatch(/^\/uploads\/public\//);

    const aftersale = await service.uploadFile(jpegUpload(), '10', 'user', 'aftersale');
    expect(aftersale.groupName).toBe('aftersale');
    expect(aftersale.url).toBe('/api/common/file/private/2');
  });

  it('does not let admins bypass business upload permissions through the common endpoint', async () => {
    prisma.adminUserRole.findMany.mockResolvedValue([
      activeRole('content_editor', ['content:list']),
    ]);
    await expect(
      service.uploadFile(jpegUpload(), '99', 'admin', 'content-cover'),
    ).rejects.toBeInstanceOf(ForbiddenException);
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