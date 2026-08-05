import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { UploadService } from './upload.service';

describe('UploadService orphan cleanup', () => {
  let uploadDir: string;
  let previousUploadDir: string | undefined;

  beforeEach(() => {
    previousUploadDir = process.env.UPLOAD_DIR;
    uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'baby-mall-upload-rollback-'));
    process.env.UPLOAD_DIR = uploadDir;
  });

  afterEach(() => {
    if (previousUploadDir === undefined) delete process.env.UPLOAD_DIR;
    else process.env.UPLOAD_DIR = previousUploadDir;
    fs.rmSync(uploadDir, { recursive: true, force: true });
  });

  it('removes the stored file when the FileAsset database insert fails', async () => {
    const prisma = {
      fileAsset: {
        create: async () => {
          throw new Error('database unavailable');
        },
      },
    };
    const service = new UploadService(prisma as any);
    jest.spyOn(service['logger'], 'error').mockImplementation(() => {});

    const buffer = Buffer.from([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10,
      0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
    ]);
    const file = {
      originalname: 'rollback.jpg',
      mimetype: 'image/jpeg',
      size: buffer.length,
      buffer,
    } as Express.Multer.File;

    await expect(service.uploadFile(file, '1', 'admin', 'content-cover'))
      .rejects.toThrow('database unavailable');

    const publicDir = path.join(uploadDir, 'public');
    expect(fs.existsSync(publicDir)).toBe(true);
    expect(fs.readdirSync(publicDir)).toEqual([]);
  });
});
