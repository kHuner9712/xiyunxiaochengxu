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
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

describe('Upload limits and MIME guard (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let tempUploadDir: string;
  let previousUploadDir: string | undefined;
  let previousAssetBase: string | undefined;

  const mockPrisma = {
    fileAsset: {
      create: jest.fn(({ data }: any) => ({ id: BigInt(1), ...data })),
      findFirst: jest.fn(),
    },
    adminUserRole: { findMany: jest.fn().mockResolvedValue([]) },
  };

  beforeAll(async () => {
    previousUploadDir = process.env.UPLOAD_DIR;
    previousAssetBase = process.env.UPLOAD_PUBLIC_URL;
    tempUploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'baby-mall-upload-limit-e2e-'));
    process.env.UPLOAD_DIR = tempUploadDir;
    process.env.UPLOAD_PUBLIC_URL = 'https://api.example.com';

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
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    jwtService = moduleFixture.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
    if (previousUploadDir === undefined) delete process.env.UPLOAD_DIR;
    else process.env.UPLOAD_DIR = previousUploadDir;
    if (previousAssetBase === undefined) delete process.env.UPLOAD_PUBLIC_URL;
    else process.env.UPLOAD_PUBLIC_URL = previousAssetBase;
    fs.rmSync(tempUploadDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    mockPrisma.fileAsset.create.mockClear();
  });

  function token() {
    return jwtService.sign({ id: '9', roleType: 'user', tokenType: 'access' });
  }

  it('超限文件被 413 拒绝', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/common/file/upload')
      .set('Authorization', `Bearer ${token()}`)
      .attach('file', Buffer.alloc(10485761), { filename: 'big.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(413);
    expect(res.body.message).toContain('File too large');
    expect(mockPrisma.fileAsset.create).not.toHaveBeenCalled();
  });

  it('错误 MIME 被 Multer 层 400 拒绝', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/common/file/upload')
      .set('Authorization', `Bearer ${token()}`)
      .attach('file', Buffer.from('<svg></svg>'), { filename: 'bad.svg', contentType: 'image/svg+xml' });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('不支持的MIME类型');
    expect(mockPrisma.fileAsset.create).not.toHaveBeenCalled();
  });

  it('伪造扩展名被 UploadService 二次校验拒绝', async () => {
    const jpegMagic = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const res = await request(app.getHttpServer())
      .post('/api/common/file/upload')
      .set('Authorization', `Bearer ${token()}`)
      .attach('file', jpegMagic, { filename: 'bad.exe', contentType: 'image/jpeg' });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('不支持的文件类型');
    expect(mockPrisma.fileAsset.create).not.toHaveBeenCalled();
  });

  it('伪造 MIME 被 UploadService magic number 校验拒绝', async () => {
    const pdfMagic = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34, 0x00, 0x00, 0x00, 0x00]);
    const res = await request(app.getHttpServer())
      .post('/api/common/file/upload')
      .set('Authorization', `Bearer ${token()}`)
      .attach('file', pdfMagic, { filename: 'bad.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('文件内容与声明类型');
    expect(mockPrisma.fileAsset.create).not.toHaveBeenCalled();
  });
});
