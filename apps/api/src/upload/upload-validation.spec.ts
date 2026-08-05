import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { UploadService } from './upload.service';

function createMp4Buffer(boxSize: number): Buffer {
  const buffer = Buffer.alloc(Math.max(boxSize, 16));
  buffer.writeUInt32BE(boxSize, 0);
  buffer.write('ftyp', 4, 'ascii');
  buffer.write('isom', 8, 'ascii');
  buffer.writeUInt32BE(0x200, 12);
  return buffer;
}

function createFile(originalname: string, mimetype: string, buffer: Buffer): Express.Multer.File {
  return {
    originalname,
    mimetype,
    size: buffer.length,
    buffer,
  } as Express.Multer.File;
}

function createPrismaMock() {
  return {
    fileAsset: {
      create: jest.fn(async ({ data }: any) => ({
        id: 1n,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      })),
      findFirst: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };
}

describe('UploadService validation', () => {
  let uploadDir: string;
  let previousUploadDir: string | undefined;
  let previousAllowedTypes: string | undefined;
  let previousMaxSize: string | undefined;

  beforeEach(() => {
    previousUploadDir = process.env.UPLOAD_DIR;
    previousAllowedTypes = process.env.UPLOAD_ALLOWED_TYPES;
    previousMaxSize = process.env.UPLOAD_MAX_SIZE;
    uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'baby-mall-upload-validation-'));
    process.env.UPLOAD_DIR = uploadDir;
    process.env.UPLOAD_ALLOWED_TYPES = 'image/webp,video/mp4';
    process.env.UPLOAD_MAX_SIZE = '52428800';
  });

  afterEach(() => {
    if (previousUploadDir === undefined) delete process.env.UPLOAD_DIR;
    else process.env.UPLOAD_DIR = previousUploadDir;
    if (previousAllowedTypes === undefined) delete process.env.UPLOAD_ALLOWED_TYPES;
    else process.env.UPLOAD_ALLOWED_TYPES = previousAllowedTypes;
    if (previousMaxSize === undefined) delete process.env.UPLOAD_MAX_SIZE;
    else process.env.UPLOAD_MAX_SIZE = previousMaxSize;
    fs.rmSync(uploadDir, { recursive: true, force: true });
  });

  it.each([20, 24, 28, 32, 36])(
    'accepts a valid MP4 ftyp box with size %i',
    async (boxSize) => {
      const prisma = createPrismaMock();
      const service = new UploadService(prisma as any);
      const result = await service.uploadFile(
        createFile('video.mp4', 'video/mp4', createMp4Buffer(boxSize)),
        '1',
        'admin',
        'content-video',
      );

      expect(result.id).toBe('1');
      expect(result.fileType).toBe('video');
      expect(prisma.fileAsset.create).toHaveBeenCalledTimes(1);
    },
  );

  it('accepts a valid MP4 when a free box precedes ftyp', async () => {
    const freeBox = Buffer.alloc(8);
    freeBox.writeUInt32BE(8, 0);
    freeBox.write('free', 4, 'ascii');
    const buffer = Buffer.concat([freeBox, createMp4Buffer(20)]);
    const prisma = createPrismaMock();
    const service = new UploadService(prisma as any);

    await expect(service.uploadFile(
      createFile('video.mp4', 'video/mp4', buffer),
      '1',
      'admin',
      'content-video',
    )).resolves.toMatchObject({ id: '1', fileType: 'video' });
  });

  it('rejects an MP4 declaration when no valid ftyp box exists', async () => {
    const buffer = Buffer.alloc(20);
    buffer.writeUInt32BE(20, 0);
    buffer.write('mdat', 4, 'ascii');
    const prisma = createPrismaMock();
    const service = new UploadService(prisma as any);

    await expect(service.uploadFile(
      createFile('fake.mp4', 'video/mp4', buffer),
      '1',
      'admin',
      'content-video',
    )).rejects.toThrow('文件内容与声明类型 video/mp4 不匹配');
    expect(prisma.fileAsset.create).not.toHaveBeenCalled();
  });

  it('accepts WebP files with arbitrary RIFF length bytes', async () => {
    const buffer = Buffer.from([
      0x52, 0x49, 0x46, 0x46,
      0xF1, 0xE2, 0xD3, 0xC4,
      0x57, 0x45, 0x42, 0x50,
      0x56, 0x50, 0x38, 0x20,
    ]);
    const prisma = createPrismaMock();
    const service = new UploadService(prisma as any);

    await expect(service.uploadFile(
      createFile('cover.webp', 'image/webp', buffer),
      '1',
      'admin',
      'content-cover',
    )).resolves.toMatchObject({ id: '1', fileType: 'image' });
  });

  it('rejects an invalid file id before querying Prisma', async () => {
    const prisma = createPrismaMock();
    const service = new UploadService(prisma as any);

    await expect(service.findPublicById('../1')).rejects.toThrow('文件ID无效');
    expect(prisma.fileAsset.findFirst).not.toHaveBeenCalled();
  });

  it('rejects an invalid uploader id before writing a file', async () => {
    const prisma = createPrismaMock();
    const service = new UploadService(prisma as any);

    await expect(service.uploadFile(
      createFile('video.mp4', 'video/mp4', createMp4Buffer(20)),
      'invalid-user',
      'admin',
      'content-video',
    )).rejects.toThrow('上传者ID无效');

    expect(prisma.fileAsset.create).not.toHaveBeenCalled();
    expect(fs.existsSync(path.join(uploadDir, 'public'))).toBe(false);
  });
});
