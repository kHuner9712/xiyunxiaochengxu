import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type { ReadStream } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { PermissionSafeUploadService } from '../src/upload/permission-safe-upload.service';

function assertSafeIntegrationDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const databaseName = decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\//, ''));
  if (
    !/(^|[_-])test($|[_-])/i.test(databaseName) &&
    process.env.ALLOW_DESTRUCTIVE_INTEGRATION_TESTS !== 'true'
  ) {
    throw new Error(`Refusing destructive integration test against database "${databaseName}"`);
  }
}

function jpegUpload(): Express.Multer.File {
  const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
  return {
    fieldname: 'file',
    originalname: 'compliance.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: buffer.length,
    buffer,
    destination: '',
    filename: '',
    path: '',
    stream: undefined as any,
  };
}

async function readAndClose(stream: ReadStream) {
  await new Promise<void>((resolve, reject) => {
    stream.once('error', reject);
    stream.once('close', resolve);
    stream.resume();
  });
}

assertSafeIntegrationDatabase();
const prisma = new PrismaClient();

async function main() {
  await prisma.$connect();
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const uploadDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'baby-mall-product-cert-'));
  process.env.UPLOAD_DIR = uploadDir;

  let permissionId: bigint | null = null;
  let permissionCreated = false;
  let roleId: bigint | null = null;
  const adminIds: bigint[] = [];
  let categoryId: bigint | null = null;
  let productId: bigint | null = null;
  let fileId: bigint | null = null;

  try {
    let permission = await prisma.adminPermission.findFirst({ where: { code: 'product:edit' } });
    if (!permission) {
      permission = await prisma.adminPermission.create({
        data: {
          code: 'product:edit',
          name: '编辑商品',
          type: 2,
          parentId: 0n,
          sortOrder: 0,
        },
      });
      permissionCreated = true;
    }
    permissionId = permission.id;

    const role = await prisma.adminRole.create({
      data: {
        code: `cert_editor_${suffix}`,
        name: `资质测试运营-${suffix}`,
        status: 1,
      },
    });
    roleId = role.id;
    await prisma.adminRolePermission.create({
      data: { roleId: role.id, permissionId: permission.id },
    });

    for (const label of ['a', 'b']) {
      const admin = await prisma.adminUser.create({
        data: {
          username: `cert_${label}_${suffix}`,
          password: 'integration-only-password-hash-placeholder',
          realName: `资质运营${label.toUpperCase()}`,
          status: 1,
        },
      });
      adminIds.push(admin.id);
      await prisma.adminUserRole.create({
        data: { adminUserId: admin.id, roleId: role.id },
      });
    }

    const service = new PermissionSafeUploadService(prisma as any);
    const uploaded: any = await service.uploadFile(
      jpegUpload(),
      adminIds[0].toString(),
      'admin',
      'cert',
    );
    fileId = BigInt(uploaded.id);
    const privateUrl = `/api/common/file/private/${fileId.toString()}`;
    assert.equal(uploaded.url, privateUrl, 'cert 上传必须返回受鉴权的私有 URL');

    const ownPreview = await service.findPrivateById(fileId.toString(), {
      id: adminIds[0].toString(),
      roleType: 'admin',
    });
    await readAndClose(ownPreview.stream);

    await assert.rejects(
      service.findPrivateById(fileId.toString(), {
        id: adminIds[1].toString(),
        roleType: 'admin',
      }),
      /尚未进入可访问的业务记录/,
      '其他商品运营不得枚举读取尚未提交的资质文件',
    );

    const category = await prisma.productCategory.create({
      data: { name: `资质真库分类-${suffix}` },
    });
    categoryId = category.id;
    const product = await prisma.product.create({
      data: {
        name: `资质真库商品-${suffix}`,
        categoryId: category.id,
        status: 3,
        attributes: {
          compliance: {
            certImages: [privateUrl],
          },
        },
      },
    });
    productId = product.id;

    const referencedPreview = await service.findPrivateById(fileId.toString(), {
      id: adminIds[1].toString(),
      roleType: 'admin',
    });
    await readAndClose(referencedPreview.stream);

    console.log('[product-cert-private-access-integration] PASS');
  } finally {
    if (productId) await prisma.product.deleteMany({ where: { id: productId } });
    if (fileId) {
      const file = await prisma.fileAsset.findUnique({ where: { id: fileId } });
      if (file) {
        const storedPath = path.join(uploadDir, String(file.filePath).replace(/^\/uploads\//, ''));
        await fsp.unlink(storedPath).catch(() => undefined);
      }
      await prisma.fileAsset.deleteMany({ where: { id: fileId } });
    }
    if (categoryId) await prisma.productCategory.deleteMany({ where: { id: categoryId } });
    if (adminIds.length > 0) {
      await prisma.adminUserRole.deleteMany({ where: { adminUserId: { in: adminIds } } });
      await prisma.adminUser.deleteMany({ where: { id: { in: adminIds } } });
    }
    if (roleId) {
      await prisma.adminRolePermission.deleteMany({ where: { roleId } });
      await prisma.adminRole.deleteMany({ where: { id: roleId } });
    }
    if (permissionCreated && permissionId) {
      await prisma.adminPermission.deleteMany({ where: { id: permissionId } });
    }
    await prisma.$disconnect();
    delete process.env.UPLOAD_DIR;
    fs.rmSync(uploadDir, { recursive: true, force: true });
  }
}

main().catch(async (error) => {
  console.error('[product-cert-private-access-integration] FAIL', error);
  await prisma.$disconnect().catch(() => undefined);
  process.exitCode = 1;
});
