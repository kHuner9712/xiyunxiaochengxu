import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import request from 'supertest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { UploadModule } from '../src/upload/upload.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { PermissionGuard } from '../src/common/guards/permission.guard';

describe('Private upload access (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let tempUploadDir: string;

  const fileAssets = new Map<string, any>();
  const mockPrisma = {
    fileAsset: {
      findFirst: jest.fn(({ where }: any) => fileAssets.get(where.id.toString()) || null),
    },
    adminUserRole: { findMany: jest.fn().mockResolvedValue([]) },
  };

  beforeAll(async () => {
    tempUploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'baby-mall-upload-e2e-'));
    process.env.UPLOAD_DIR = tempUploadDir;
    fs.mkdirSync(path.join(tempUploadDir, 'public'), { recursive: true });
    fs.mkdirSync(path.join(tempUploadDir, 'private'), { recursive: true });
    fs.writeFileSync(path.join(tempUploadDir, 'public', 'product.jpg'), 'public');
    fs.writeFileSync(path.join(tempUploadDir, 'private', 'refund.jpg'), 'private');

    fileAssets.set('1', {
      id: BigInt(1), fileName: 'product.jpg', originalName: 'product.jpg',
      filePath: '/uploads/public/product.jpg', fileSize: BigInt(6), fileType: 'image',
      mimeType: 'image/jpeg', storageType: 1, url: '/uploads/public/product.jpg',
      groupName: 'product', uploaderId: BigInt(1), uploaderType: 'admin',
    });
    fileAssets.set('2', {
      id: BigInt(2), fileName: 'refund.jpg', originalName: 'refund.jpg',
      filePath: '/uploads/private/refund.jpg', fileSize: BigInt(7), fileType: 'image',
      mimeType: 'image/jpeg', storageType: 1, url: null,
      groupName: 'aftersale', uploaderId: BigInt(9), uploaderType: 'user',
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({ secret: 'test_jwt_secret_key_that_is_long_enough_32chars' }),
        UploadModule,
      ],
      providers: [
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: PermissionGuard },
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    jwtService = moduleFixture.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
    fs.rmSync(tempUploadDir, { recursive: true, force: true });
  });

  function sign(payload: any) {
    return jwtService.sign({ ...payload, tokenType: 'access' });
  }

  it('未登录访问敏感组文件返回 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/common/file/private/2');
    expect(res.status).toBe(401);
  });

  it('未登录访问公开商品图详情允许', async () => {
    const res = await request(app.getHttpServer()).get('/api/common/file/1');
    expect(res.status).toBe(200);
    expect(res.body.url).toContain('/uploads/public/product.jpg');
  });

  it('公开接口访问敏感文件返回 403', async () => {
    const res = await request(app.getHttpServer()).get('/api/common/file/2');
    expect(res.status).toBe(403);
  });

  it('所属用户可以访问敏感附件', async () => {
    const token = sign({ id: '9', roleType: 'user' });
    const res = await request(app.getHttpServer())
      .get('/api/common/file/private/2')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.text || res.body.toString()).toBe('private');
  });

  it('非所属用户访问敏感附件返回 403', async () => {
    const token = sign({ id: '8', roleType: 'user' });
    const res = await request(app.getHttpServer())
      .get('/api/common/file/private/2')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('管理员可以访问敏感附件', async () => {
    const token = sign({ id: '1', roleType: 'admin' });
    const res = await request(app.getHttpServer())
      .get('/api/common/file/private/2')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.text || res.body.toString()).toBe('private');
  });
});
