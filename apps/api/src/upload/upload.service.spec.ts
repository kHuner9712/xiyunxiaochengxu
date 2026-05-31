import { describe, it, expect } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { UploadService } from './upload.service';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

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

const DEFAULT_ALLOWED_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
  '.mp4',
];

const DEFAULT_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
];

describe('UploadService 文件安全校验', () => {
  describe('DEFAULT_ALLOWED_EXTENSIONS 白名单', () => {
    it('应允许 jpg/png/gif/webp 图片', () => {
      const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      for (const ext of allowed) {
        expect(DEFAULT_ALLOWED_EXTENSIONS).toContain(ext);
      }
    });

    it('不应允许 svg 扩展名', () => {
      expect(DEFAULT_ALLOWED_EXTENSIONS).not.toContain('.svg');
    });

    it('不应允许可执行文件扩展名', () => {
      const dangerous = ['.exe', '.bat', '.sh', '.php', '.jsp', '.asp', '.html', '.htm', '.js', '.svg'];
      for (const ext of dangerous) {
        expect(DEFAULT_ALLOWED_EXTENSIONS).not.toContain(ext);
      }
    });
  });

  describe('DEFAULT_ALLOWED_MIME_TYPES 白名单', () => {
    it('不应允许 image/svg+xml MIME 类型', () => {
      expect(DEFAULT_ALLOWED_MIME_TYPES).not.toContain('image/svg+xml');
    });

    it('不应允许脚本相关 MIME 类型', () => {
      const dangerous = [
        'text/html', 'application/javascript', 'text/javascript',
        'application/x-php', 'application/x-jsp',
        'image/svg+xml',
      ];
      for (const mime of dangerous) {
        expect(DEFAULT_ALLOWED_MIME_TYPES).not.toContain(mime);
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

describe('UploadService 文件大小限制', () => {
  let service: UploadService;
  let mockPrisma: any;

  beforeEach(() => {
    ({ service, mockPrisma } = createService());
  });

  it('文件大小超过 UPLOAD_MAX_SIZE 时抛出 BadRequestException', async () => {
    const originalEnv = process.env.UPLOAD_MAX_SIZE;
    process.env.UPLOAD_MAX_SIZE = '100';
    const file = {
      originalname: 'test.jpg',
      mimetype: 'image/jpeg',
      buffer: Buffer.alloc(200),
      size: 200,
    } as Express.Multer.File;
    await expect(service.uploadFile(file, '1', 'user'))
      .rejects.toThrow(BadRequestException);
    process.env.UPLOAD_MAX_SIZE = originalEnv;
  });

  it('文件大小在限制内时正常上传', async () => {
    const originalEnv = process.env.UPLOAD_MAX_SIZE;
    const originalAssetBase = process.env.UPLOAD_PUBLIC_URL;
    process.env.UPLOAD_MAX_SIZE = '10485760';
    process.env.UPLOAD_PUBLIC_URL = 'https://api.example.com';
    (service as any).storageProvider = {
      save: jest.fn().mockResolvedValue({ filePath: '/uploads/test.jpg', url: '/uploads/test.jpg' }),
      remove: jest.fn(),
    };
    const file = {
      originalname: 'test.jpg',
      mimetype: 'image/jpeg',
      buffer: Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]),
      size: 12,
    } as Express.Multer.File;
    mockPrisma.fileAsset.create.mockResolvedValue({
      id: BigInt(1), fileName: 'test.jpg', filePath: '/uploads/test.jpg',
      fileSize: BigInt(12), fileType: 'image', mimeType: 'image/jpeg',
      storageType: 1, url: '/uploads/test.jpg', groupName: null,
      uploaderId: BigInt(1), uploaderType: 'user',
    });
    const result = await service.uploadFile(file, '1', 'user');
    expect(result.url).toBe('https://api.example.com/uploads/test.jpg');
    expect(result.filePath).toBe('/uploads/test.jpg');
    process.env.UPLOAD_MAX_SIZE = originalEnv;
    process.env.UPLOAD_PUBLIC_URL = originalAssetBase;
  });
});

describe('UploadService 文件魔数校验', () => {
  let service: UploadService;
  let mockPrisma: any;

  beforeEach(() => {
    ({ service, mockPrisma } = createService());
  });

  it('JPEG 文件魔数正确时不报错', () => {
    const file = {
      originalname: 'test.jpg',
      mimetype: 'image/jpeg',
      buffer: Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]),
      size: 12,
    } as Express.Multer.File;
    expect(() => service['validateFileMagic'](file)).not.toThrow();
  });

  it('PNG 文件魔数正确时不报错', () => {
    const file = {
      originalname: 'test.png',
      mimetype: 'image/png',
      buffer: Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]),
      size: 12,
    } as Express.Multer.File;
    expect(() => service['validateFileMagic'](file)).not.toThrow();
  });

  it('文件魔数与声明 MIME 不匹配时抛出 BadRequestException', () => {
    const file = {
      originalname: 'malicious.jpg',
      mimetype: 'image/jpeg',
      buffer: Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34, 0x00, 0x00, 0x00, 0x00]),
      size: 12,
    } as Express.Multer.File;
    expect(() => service['validateFileMagic'](file)).toThrow(BadRequestException);
  });

  it('无魔数映射的 MIME 类型跳过校验', () => {
    const file = {
      originalname: 'test.txt',
      mimetype: 'text/plain',
      buffer: Buffer.from([0x48, 0x65, 0x6C, 0x6C, 0x6F, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]),
      size: 12,
    } as Express.Multer.File;
    expect(() => service['validateFileMagic'](file)).not.toThrow();
  });
});

describe('UploadService Office 文档默认禁用', () => {
  it('不应允许 .doc 扩展名', () => {
    expect(DEFAULT_ALLOWED_EXTENSIONS).not.toContain('.doc');
  });

  it('不应允许 .docx 扩展名', () => {
    expect(DEFAULT_ALLOWED_EXTENSIONS).not.toContain('.docx');
  });

  it('不应允许 .xls 扩展名', () => {
    expect(DEFAULT_ALLOWED_EXTENSIONS).not.toContain('.xls');
  });

  it('不应允许 .xlsx 扩展名', () => {
    expect(DEFAULT_ALLOWED_EXTENSIONS).not.toContain('.xlsx');
  });

  it('不应允许 application/msword MIME', () => {
    expect(DEFAULT_ALLOWED_MIME_TYPES).not.toContain('application/msword');
  });

  it('不应允许 Office Open XML MIME', () => {
    expect(DEFAULT_ALLOWED_MIME_TYPES).not.toContain('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  });
});

describe('UploadService webp RIFF+WEBP magic', () => {
  let service: UploadService;
  let mockPrisma: any;

  beforeEach(() => {
    ({ service, mockPrisma } = createService());
  });

  it('webp 文件 RIFF+WEBP magic 正确时不报错', () => {
    const file = {
      originalname: 'test.webp',
      mimetype: 'image/webp',
      buffer: Buffer.from([0x52, 0x49, 0x46, 0x46, 0x0A, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]),
      size: 12,
    } as Express.Multer.File;
    expect(() => service['validateFileMagic'](file)).not.toThrow();
  });

  it('webp 文件缺少 WEBP 标识时抛出 BadRequestException', () => {
    const file = {
      originalname: 'fake.webp',
      mimetype: 'image/webp',
      buffer: Buffer.from([0x52, 0x49, 0x46, 0x46, 0x0A, 0x00, 0x00, 0x00, 0x4E, 0x4F, 0x54, 0x50]),
      size: 12,
    } as Express.Multer.File;
    expect(() => service['validateFileMagic'](file)).toThrow(BadRequestException);
  });
});

describe('UploadService webm removed', () => {
  it('不应允许 video/webm MIME', () => {
    expect(DEFAULT_ALLOWED_MIME_TYPES).not.toContain('video/webm');
  });

  it('不应允许 .webm 扩展名', () => {
    expect(DEFAULT_ALLOWED_EXTENSIONS).not.toContain('.webm');
  });
});

describe('UploadService 本地存储删除路径', () => {
  it('UPLOAD_DIR 为自定义目录时应删除真实文件', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'upload-test-'));
    const previousUploadDir = process.env.UPLOAD_DIR;
    process.env.UPLOAD_DIR = tmpDir;

    const prisma = createMockPrisma();
    prisma.fileAsset.findFirst.mockResolvedValue({
      id: BigInt(1),
      fileName: 'test.jpg',
      filePath: '/uploads/test.jpg',
    });
    prisma.fileAsset.delete.mockResolvedValue({});

    const { service } = createService(prisma);
    const targetFile = path.join(tmpDir, 'test.jpg');
    fs.writeFileSync(targetFile, Buffer.from('abc'));

    await service.delete('1');
    expect(fs.existsSync(targetFile)).toBe(false);

    process.env.UPLOAD_DIR = previousUploadDir;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe('UploadService UPLOAD_ALLOWED_TYPES 环境变量驱动', () => {
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
  });

  afterEach(() => {
    delete process.env.UPLOAD_ALLOWED_TYPES;
  });

  it('默认不允许 application/pdf', () => {
    const { service } = createService(mockPrisma);
    expect(service['allowedMimeTypes']).not.toContain('application/pdf');
    expect(service['allowedExtensions']).not.toContain('.pdf');
  });

  it('默认不允许 image/bmp', () => {
    const { service } = createService(mockPrisma);
    expect(service['allowedMimeTypes']).not.toContain('image/bmp');
    expect(service['allowedExtensions']).not.toContain('.bmp');
  });

  it('设置 UPLOAD_ALLOWED_TYPES 后允许 PDF', () => {
    process.env.UPLOAD_ALLOWED_TYPES = 'image/jpeg,image/png,application/pdf';
    const { service } = createService(mockPrisma);
    expect(service['allowedMimeTypes']).toContain('application/pdf');
    expect(service['allowedExtensions']).toContain('.pdf');
    expect(service['allowedMimeTypes']).not.toContain('image/gif');
  });

  it('上传 PDF 文件在默认配置下被拒绝', async () => {
    const { service } = createService(mockPrisma);
    const file = {
      originalname: 'test.pdf',
      mimetype: 'application/pdf',
      buffer: Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34, 0x0A, 0x25, 0xE2, 0xE3]),
      size: 12,
    } as Express.Multer.File;
    await expect(service.uploadFile(file, '1', 'user'))
      .rejects.toThrow(BadRequestException);
  });

  it('上传 PDF 文件在配置允许时通过', async () => {
    process.env.UPLOAD_ALLOWED_TYPES = 'image/jpeg,application/pdf';
    const { service } = createService(mockPrisma);
    (service as any).storageProvider = {
      save: jest.fn().mockResolvedValue({ filePath: '/uploads/test.pdf', url: '/uploads/test.pdf' }),
      remove: jest.fn(),
    };
    mockPrisma.fileAsset.create.mockResolvedValue({
      id: BigInt(1), fileName: 'test.pdf', filePath: '/uploads/test.pdf',
      fileSize: BigInt(12), fileType: 'document', mimeType: 'application/pdf',
      storageType: 1, url: '/uploads/test.pdf', groupName: null,
      uploaderId: BigInt(1), uploaderType: 'user',
    });
    const file = {
      originalname: 'test.pdf',
      mimetype: 'application/pdf',
      buffer: Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34, 0x0A, 0x25, 0xE2, 0xE3]),
      size: 12,
    } as Express.Multer.File;
    const result = await service.uploadFile(file, '1', 'user');
    expect(result.fileType).toBe('document');
  });
});
