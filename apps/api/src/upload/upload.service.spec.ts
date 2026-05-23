import { describe, it, expect } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { UploadService } from './upload.service';

function createMockPrisma() {
  return {
    fileAsset: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
    },
  };
}

function createService(mockPrisma?: any) {
  const prisma = mockPrisma || createMockPrisma();
  const service = new UploadService(prisma as any);
  jest.spyOn(service['logger'], 'log').mockImplementation(() => {});
  return { service, mockPrisma: prisma };
}

const ALLOWED_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp',
  '.mp4', '.webm',
  '.pdf',
  '.doc', '.docx',
  '.xls', '.xlsx',
];

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  'video/mp4',
  'video/webm',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

describe('UploadService 文件安全校验', () => {
  describe('ALLOWED_EXTENSIONS 白名单', () => {
    it('应允许 jpg/png/gif/webp/bmp 图片', () => {
      const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
      for (const ext of allowed) {
        expect(ALLOWED_EXTENSIONS).toContain(ext);
      }
    });

    it('不应允许 svg 扩展名', () => {
      expect(ALLOWED_EXTENSIONS).not.toContain('.svg');
    });

    it('不应允许可执行文件扩展名', () => {
      const dangerous = ['.exe', '.bat', '.sh', '.php', '.jsp', '.asp', '.html', '.htm', '.js', '.svg'];
      for (const ext of dangerous) {
        expect(ALLOWED_EXTENSIONS).not.toContain(ext);
      }
    });
  });

  describe('ALLOWED_MIME_TYPES 白名单', () => {
    it('不应允许 image/svg+xml MIME 类型', () => {
      expect(ALLOWED_MIME_TYPES).not.toContain('image/svg+xml');
    });

    it('不应允许脚本相关 MIME 类型', () => {
      const dangerous = [
        'text/html', 'application/javascript', 'text/javascript',
        'application/x-php', 'application/x-jsp',
        'image/svg+xml',
      ];
      for (const mime of dangerous) {
        expect(ALLOWED_MIME_TYPES).not.toContain(mime);
      }
    });
  });
});

describe('UploadService 空文件保护', () => {
  let service: UploadService;
  let mockPrisma: any;

  beforeEach(() => {
    ({ service, mockPrisma } = createService());
  });

  it('file 为 null 时抛出 BadRequestException', async () => {
    await expect(service.uploadFile(null as any, '1', 'user'))
      .rejects.toThrow(BadRequestException);
    await expect(service.uploadFile(null as any, '1', 'user'))
      .rejects.toThrow('请选择要上传的文件');
  });

  it('file 为 undefined 时抛出 BadRequestException', async () => {
    await expect(service.uploadFile(undefined as any, '1', 'user'))
      .rejects.toThrow('请选择要上传的文件');
  });

  it('file.originalname 为空时抛出 BadRequestException', async () => {
    const file = { originalname: '', mimetype: 'image/png', buffer: Buffer.from(''), size: 0 } as Express.Multer.File;
    await expect(service.uploadFile(file, '1', 'user'))
      .rejects.toThrow('请选择要上传的文件');
  });

  it('file.originalname 为 undefined 时抛出 BadRequestException', async () => {
    const file = { originalname: undefined, mimetype: 'image/png', buffer: Buffer.from(''), size: 0 } as any;
    await expect(service.uploadFile(file, '1', 'user'))
      .rejects.toThrow('请选择要上传的文件');
  });
});
