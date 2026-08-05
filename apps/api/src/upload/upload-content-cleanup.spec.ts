import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { UploadService } from './upload.service';

function createFileAsset(overrides: Record<string, unknown> = {}) {
  return {
    id: 10n,
    fileName: 'pending.mp4',
    originalName: 'pending.mp4',
    filePath: '/uploads/public/pending.mp4',
    fileSize: 16n,
    fileType: 'video',
    mimeType: 'video/mp4',
    storageType: 1,
    url: '/uploads/public/pending.mp4',
    groupName: 'content-video',
    uploaderId: 7n,
    uploaderType: 'admin',
    createdAt: new Date(),
    ...overrides,
  };
}

describe('UploadService pending content cleanup', () => {
  let uploadDir: string;
  let previousUploadDir: string | undefined;
  let prisma: any;
  let service: UploadService;

  beforeEach(() => {
    previousUploadDir = process.env.UPLOAD_DIR;
    uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'baby-mall-content-cleanup-'));
    process.env.UPLOAD_DIR = uploadDir;
    fs.mkdirSync(path.join(uploadDir, 'public'), { recursive: true });
    fs.writeFileSync(path.join(uploadDir, 'public', 'pending.mp4'), Buffer.from('test'));

    prisma = {
      fileAsset: {
        findFirst: jest.fn().mockResolvedValue(createFileAsset()),
        delete: jest.fn().mockResolvedValue(createFileAsset()),
      },
      content: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    service = new UploadService(prisma);
  });

  afterEach(() => {
    if (previousUploadDir === undefined) delete process.env.UPLOAD_DIR;
    else process.env.UPLOAD_DIR = previousUploadDir;
    fs.rmSync(uploadDir, { recursive: true, force: true });
  });

  it('deletes an unreferenced content asset owned by the current administrator', async () => {
    await expect(service.deletePendingContentAsset('10', '7')).resolves.toEqual({ success: true });

    expect(prisma.content.findFirst).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        OR: [
          { coverImage: { endsWith: '/uploads/public/pending.mp4' } },
          { videoUrl: { endsWith: '/uploads/public/pending.mp4' } },
          { videoCover: { endsWith: '/uploads/public/pending.mp4' } },
        ],
      },
      select: { id: true },
    });
    expect(prisma.fileAsset.delete).toHaveBeenCalledWith({ where: { id: 10n } });
    expect(fs.existsSync(path.join(uploadDir, 'public', 'pending.mp4'))).toBe(false);
  });

  it('rejects deleting another administrator’s upload', async () => {
    await expect(service.deletePendingContentAsset('10', '8')).rejects.toThrow(
      '只能清理当前管理员本人上传且尚未提交的内容素材',
    );

    expect(prisma.content.findFirst).not.toHaveBeenCalled();
    expect(prisma.fileAsset.delete).not.toHaveBeenCalled();
    expect(fs.existsSync(path.join(uploadDir, 'public', 'pending.mp4'))).toBe(true);
  });

  it('rejects deleting a file outside the content upload groups', async () => {
    prisma.fileAsset.findFirst.mockResolvedValue(createFileAsset({ groupName: 'product-image' }));

    await expect(service.deletePendingContentAsset('10', '7')).rejects.toThrow(
      '只能清理当前管理员本人上传且尚未提交的内容素材',
    );
    expect(prisma.fileAsset.delete).not.toHaveBeenCalled();
  });

  it('rejects deleting an asset already referenced by active content', async () => {
    prisma.content.findFirst.mockResolvedValue({ id: 99n });

    await expect(service.deletePendingContentAsset('10', '7')).rejects.toThrow(
      '文件已被内容引用，不能删除',
    );

    expect(prisma.fileAsset.delete).not.toHaveBeenCalled();
    expect(fs.existsSync(path.join(uploadDir, 'public', 'pending.mp4'))).toBe(true);
  });
});
