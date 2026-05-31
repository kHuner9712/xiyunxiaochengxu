import { describe, it, expect } from '@jest/globals';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UploadService } from './upload.service';
import { createUploadMulterOptions, getUploadMaxSize } from './upload.multer-options';
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

  beforeEach(() => {
    ({ service } = createService());
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
      save: jest.fn().mockResolvedValue({ filePath: '/uploads/public/test.jpg', url: '/uploads/public/test.jpg' }),
      remove: jest.fn(),
    };
    const file = {
      originalname: 'test.jpg',
      mimetype: 'image/jpeg',
      buffer: Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]),
      size: 12,
    } as Express.Multer.File;
    mockPrisma.fileAsset.create.mockResolvedValue({
      id: BigInt(1), fileName: 'test.jpg', filePath: '/uploads/public/test.jpg',
      fileSize: BigInt(12), fileType: 'image', mimeType: 'image/jpeg',
      storageType: 1, url: '/uploads/public/test.jpg', groupName: null,
      uploaderId: BigInt(1), uploaderType: 'user',
    });
    const result = await service.uploadFile(file, '1', 'user');
    expect(result.url).toBe('https://api.example.com/uploads/public/test.jpg');
    expect(result.filePath).toBe('/uploads/public/test.jpg');
    process.env.UPLOAD_MAX_SIZE = originalEnv;
    process.env.UPLOAD_PUBLIC_URL = originalAssetBase;
  });
});

describe('UploadService 文件魔数校验', () => {
  let service: UploadService;

  beforeEach(() => {
    ({ service } = createService());
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

  beforeEach(() => {
    ({ service } = createService());
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
  it('public 上传写入 public 目录并返回公开地址', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'upload-public-test-'));
    const previousUploadDir = process.env.UPLOAD_DIR;
    const previousAssetBase = process.env.UPLOAD_PUBLIC_URL;
    process.env.UPLOAD_DIR = tmpDir;
    process.env.UPLOAD_PUBLIC_URL = 'https://api.example.com';

    try {
      const prisma = createMockPrisma();
      prisma.fileAsset.create.mockImplementation(async ({ data }: any) => ({ id: BigInt(1), ...data }));
      const { service } = createService(prisma);
      const file = {
        originalname: 'test.png',
        mimetype: 'image/png',
        buffer: Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]),
        size: 12,
      } as Express.Multer.File;

      const result = await service.uploadFile(file, '1', 'user');

      expect(result.filePath).toMatch(/^\/uploads\/public\/.+\.png$/);
      expect(result.url).toBe(`https://api.example.com${result.filePath}`);
      expect(fs.existsSync(path.join(tmpDir, 'public', result.fileName))).toBe(true);
    } finally {
      if (previousUploadDir === undefined) delete process.env.UPLOAD_DIR;
      else process.env.UPLOAD_DIR = previousUploadDir;
      if (previousAssetBase === undefined) delete process.env.UPLOAD_PUBLIC_URL;
      else process.env.UPLOAD_PUBLIC_URL = previousAssetBase;
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('private group 上传写入 private 目录并返回私有文件接口地址', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'upload-private-test-'));
    const previousUploadDir = process.env.UPLOAD_DIR;
    const previousAssetBase = process.env.UPLOAD_PUBLIC_URL;
    process.env.UPLOAD_DIR = tmpDir;
    process.env.UPLOAD_PUBLIC_URL = 'https://api.example.com';

    try {
      const prisma = createMockPrisma();
      prisma.fileAsset.create.mockImplementation(async ({ data }: any) => ({ id: BigInt(2), ...data }));
      const { service } = createService(prisma);
      const file = {
        originalname: 'refund.png',
        mimetype: 'image/png',
        buffer: Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]),
        size: 12,
      } as Express.Multer.File;

      const result = await service.uploadFile(file, '9', 'user', 'aftersale');

      expect(result.filePath).toMatch(/^\/uploads\/private\/.+\.png$/);
      expect(result.url).toBe('/api/common/file/private/2');
      expect(result.groupName).toBe('aftersale');
      expect(fs.existsSync(path.join(tmpDir, 'private', result.fileName))).toBe(true);
    } finally {
      if (previousUploadDir === undefined) delete process.env.UPLOAD_DIR;
      else process.env.UPLOAD_DIR = previousUploadDir;
      if (previousAssetBase === undefined) delete process.env.UPLOAD_PUBLIC_URL;
      else process.env.UPLOAD_PUBLIC_URL = previousAssetBase;
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

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

    if (previousUploadDir === undefined) delete process.env.UPLOAD_DIR;
    else process.env.UPLOAD_DIR = previousUploadDir;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('非法路径删除被拒绝且不删除数据库记录', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'upload-delete-guard-'));
    const previousUploadDir = process.env.UPLOAD_DIR;
    process.env.UPLOAD_DIR = tmpDir;

    try {
      const prisma = createMockPrisma();
      prisma.fileAsset.findFirst.mockResolvedValue({
        id: BigInt(1),
        fileName: 'outside.jpg',
        filePath: '/uploads/../outside.jpg',
      });
      const { service } = createService(prisma);

      await expect(service.delete('1')).rejects.toThrow(BadRequestException);
      expect(prisma.fileAsset.delete).not.toHaveBeenCalled();
    } finally {
      if (previousUploadDir === undefined) delete process.env.UPLOAD_DIR;
      else process.env.UPLOAD_DIR = previousUploadDir;
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('磁盘文件不存在时删除仍清理数据库记录', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'upload-delete-missing-'));
    const previousUploadDir = process.env.UPLOAD_DIR;
    process.env.UPLOAD_DIR = tmpDir;

    try {
      const prisma = createMockPrisma();
      prisma.fileAsset.findFirst.mockResolvedValue({
        id: BigInt(1),
        fileName: 'missing.jpg',
        filePath: '/uploads/public/missing.jpg',
      });
      prisma.fileAsset.delete.mockResolvedValue({});
      const { service } = createService(prisma);

      await expect(service.delete('1')).resolves.toEqual({ success: true });
      expect(prisma.fileAsset.delete).toHaveBeenCalledWith({ where: { id: BigInt(1) } });
    } finally {
      if (previousUploadDir === undefined) delete process.env.UPLOAD_DIR;
      else process.env.UPLOAD_DIR = previousUploadDir;
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('私有文件磁盘不存在时读取返回 NotFoundException', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'upload-private-missing-'));
    const previousUploadDir = process.env.UPLOAD_DIR;
    process.env.UPLOAD_DIR = tmpDir;

    try {
      const prisma = createMockPrisma();
      prisma.fileAsset.findFirst.mockResolvedValue({
        id: BigInt(1),
        fileName: 'missing.jpg',
        originalName: 'missing.jpg',
        filePath: '/uploads/private/missing.jpg',
        mimeType: 'image/jpeg',
        groupName: 'aftersale',
        uploaderId: BigInt(9),
        uploaderType: 'user',
      });
      const { service } = createService(prisma);

      await expect(service.findPrivateById('1', { id: '9', roleType: 'user' }))
        .rejects.toThrow(NotFoundException);
    } finally {
      if (previousUploadDir === undefined) delete process.env.UPLOAD_DIR;
      else process.env.UPLOAD_DIR = previousUploadDir;
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
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

describe('UploadModule fileFilter 第一层拦截', () => {
  it('MIME 不允许的文件被 fileFilter 拒绝', () => {
    const options = createUploadMulterOptions();
    const file = { originalname: 'test.svg', mimetype: 'image/svg+xml' } as Express.Multer.File;
    const callback = jest.fn();

    options.fileFilter?.({} as any, file, callback);

    expect(callback).toHaveBeenCalledWith(expect.any(BadRequestException), false);
  });

  it('扩展名伪造但 MIME 合法时由 service 二次校验处理', () => {
    const options = createUploadMulterOptions();
    const file = { originalname: 'test.exe', mimetype: 'image/jpeg' } as Express.Multer.File;
    const callback = jest.fn();

    options.fileFilter?.({} as any, file, callback);

    expect(callback).toHaveBeenCalledWith(null, true);
  });

  it('MIME 合法的文件通过 fileFilter', () => {
    const options = createUploadMulterOptions();
    const file = { originalname: 'test.jpg', mimetype: 'image/jpeg' } as Express.Multer.File;
    const callback = jest.fn();

    options.fileFilter?.({} as any, file, callback);

    expect(callback).toHaveBeenCalledWith(null, true);
  });
});

describe('UploadService 双层防线：扩展名伪装但 magic number 不匹配', () => {
  let service: UploadService;
  let mockPrisma: any;

  beforeEach(() => {
    ({ service, mockPrisma } = createService());
  });

  it('扩展名伪装为 .jpg 但内容为 PDF 的文件仍被 service 拒绝', async () => {
    const storageProvider = {
      save: jest.fn(),
      remove: jest.fn(),
      createReadStream: jest.fn(),
    };
    (service as any).storageProvider = storageProvider;
    const file = {
      originalname: 'malicious.jpg',
      mimetype: 'image/jpeg',
      buffer: Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34, 0x00, 0x00, 0x00, 0x00]),
      size: 12,
    } as Express.Multer.File;
    await expect(service.uploadFile(file, '1', 'user'))
      .rejects.toThrow(BadRequestException);
    await expect(service.uploadFile(file, '1', 'user'))
      .rejects.toThrow('文件内容与声明类型');
    expect(storageProvider.save).not.toHaveBeenCalled();
    expect(mockPrisma.fileAsset.create).not.toHaveBeenCalled();
  });
});

describe('Multer interceptor 层 fileSize 限制', () => {
  it('UPLOAD_MAX_SIZE 默认值为 10MB', () => {
    const originalEnv = process.env.UPLOAD_MAX_SIZE;
    delete process.env.UPLOAD_MAX_SIZE;
    expect(getUploadMaxSize()).toBe(10485760);
    process.env.UPLOAD_MAX_SIZE = originalEnv;
  });

  it('超过 UPLOAD_MAX_SIZE 的文件在 service 层被拒绝', async () => {
    const { service } = createService();
    const originalEnv = process.env.UPLOAD_MAX_SIZE;
    process.env.UPLOAD_MAX_SIZE = '100';
    const file = {
      originalname: 'test.jpg',
      mimetype: 'image/jpeg',
      buffer: Buffer.alloc(200),
      size: 200,
    } as Express.Multer.File;
    await expect(service.uploadFile(file, '1', 'user'))
      .rejects.toThrow('文件大小超过限制');
    process.env.UPLOAD_MAX_SIZE = originalEnv;
  });
});

describe('UploadService findPublicById 公开文件详情', () => {
  let service: UploadService;
  let mockPrisma: any;

  beforeEach(() => {
    ({ service, mockPrisma } = createService());
  });

  it('公开文件详情仅返回 id、url、fileType、mimeType', async () => {
    const originalAssetBase = process.env.UPLOAD_PUBLIC_URL;
    process.env.UPLOAD_PUBLIC_URL = 'https://api.example.com';
    mockPrisma.fileAsset.findFirst.mockResolvedValue({
      id: BigInt(1), fileName: 'test.jpg', originalName: 'photo.jpg',
      filePath: '/uploads/public/test.jpg', fileSize: BigInt(1024), fileType: 'image',
      mimeType: 'image/jpeg', storageType: 1, url: '/uploads/public/test.jpg',
      groupName: null, uploaderId: BigInt(1), uploaderType: 'user',
    });
    const result = await service.findPublicById('1');
    expect(result).toEqual({
      id: '1',
      url: 'https://api.example.com/uploads/public/test.jpg',
      fileType: 'image',
      mimeType: 'image/jpeg',
    });
    expect((result as any).originalName).toBeUndefined();
    expect((result as any).uploaderId).toBeUndefined();
    expect((result as any).filePath).toBeUndefined();
    expect((result as any).groupName).toBeUndefined();
    process.env.UPLOAD_PUBLIC_URL = originalAssetBase;
  });

  it('敏感分组文件公开接口返回 403 ForbiddenException', async () => {
    mockPrisma.fileAsset.findFirst.mockResolvedValue({
      id: BigInt(2), fileName: 'refund.jpg', originalName: 'refund_proof.jpg',
      filePath: '/uploads/refund.jpg', fileSize: BigInt(2048), fileType: 'image',
      mimeType: 'image/jpeg', storageType: 1, url: '/uploads/refund.jpg',
      groupName: 'aftersale', uploaderId: BigInt(1), uploaderType: 'admin',
    });
    await expect(service.findPublicById('2'))
      .rejects.toThrow(ForbiddenException);
    await expect(service.findPublicById('2'))
      .rejects.toThrow('该文件不允许公开访问');
  });

  it('admin 分组文件公开接口返回 403', async () => {
    mockPrisma.fileAsset.findFirst.mockResolvedValue({
      id: BigInt(3), groupName: 'admin', fileName: 'admin.jpg',
      filePath: '/uploads/admin.jpg', url: '/uploads/admin.jpg',
      fileType: 'image', mimeType: 'image/jpeg', storageType: 1,
      uploaderId: BigInt(1), uploaderType: 'admin',
    });
    await expect(service.findPublicById('3'))
      .rejects.toThrow(ForbiddenException);
  });

  it('groupName 为 null 时正常返回公开字段', async () => {
    const originalAssetBase = process.env.UPLOAD_PUBLIC_URL;
    process.env.UPLOAD_PUBLIC_URL = 'https://api.example.com';
    mockPrisma.fileAsset.findFirst.mockResolvedValue({
      id: BigInt(4), fileName: 'product.jpg', originalName: 'product.jpg',
      filePath: '/uploads/public/product.jpg', fileSize: BigInt(512), fileType: 'image',
      mimeType: 'image/jpeg', storageType: 1, url: '/uploads/public/product.jpg',
      groupName: null, uploaderId: BigInt(1), uploaderType: 'user',
    });
    const result = await service.findPublicById('4');
    expect(result.id).toBe('4');
    expect(result.fileType).toBe('image');
    process.env.UPLOAD_PUBLIC_URL = originalAssetBase;
  });

  it('groupName 为非敏感分组时正常返回公开字段', async () => {
    const originalAssetBase = process.env.UPLOAD_PUBLIC_URL;
    process.env.UPLOAD_PUBLIC_URL = 'https://api.example.com';
    mockPrisma.fileAsset.findFirst.mockResolvedValue({
      id: BigInt(5), fileName: 'banner.jpg', originalName: 'banner.jpg',
      filePath: '/uploads/public/banner.jpg', fileSize: BigInt(3072), fileType: 'image',
      mimeType: 'image/jpeg', storageType: 1, url: '/uploads/public/banner.jpg',
      groupName: 'product', uploaderId: BigInt(1), uploaderType: 'user',
    });
    const result = await service.findPublicById('5');
    expect(result.id).toBe('5');
    expect(result.fileType).toBe('image');
    process.env.UPLOAD_PUBLIC_URL = originalAssetBase;
  });

  it('文件不存在时返回 404 NotFoundException', async () => {
    mockPrisma.fileAsset.findFirst.mockResolvedValue(null);
    await expect(service.findPublicById('999'))
      .rejects.toThrow(NotFoundException);
  });
});

describe('UploadService findById 管理员文件详情返回完整字段', () => {
  let service: UploadService;
  let mockPrisma: any;

  beforeEach(() => {
    ({ service, mockPrisma } = createService());
  });

  it('管理员文件详情返回完整字段', async () => {
    const originalAssetBase = process.env.UPLOAD_PUBLIC_URL;
    process.env.UPLOAD_PUBLIC_URL = 'https://api.example.com';
    mockPrisma.fileAsset.findFirst.mockResolvedValue({
      id: BigInt(1), fileName: 'test.jpg', originalName: 'photo.jpg',
      filePath: '/uploads/test.jpg', fileSize: BigInt(1024), fileType: 'image',
      mimeType: 'image/jpeg', storageType: 1, url: '/uploads/test.jpg',
      groupName: 'aftersale', uploaderId: BigInt(1), uploaderType: 'admin',
    });
    const result = await service.findById('1');
    expect(result.id).toBe('1');
    expect(result.originalName).toBe('photo.jpg');
    expect(result.uploaderId).toBe('1');
    expect(result.uploaderType).toBe('admin');
    expect(result.groupName).toBe('aftersale');
    expect(result.filePath).toBe('/uploads/test.jpg');
    process.env.UPLOAD_PUBLIC_URL = originalAssetBase;
  });
});

describe('UploadService public/private uploads', () => {
  let service: UploadService;
  let mockPrisma: any;

  beforeEach(() => {
    ({ service, mockPrisma } = createService());
  });

  it('公共商品图保存到 public 并返回公开 URL', async () => {
    const save = jest.fn().mockResolvedValue({ filePath: '/uploads/public/product.jpg', url: '/uploads/public/product.jpg' });
    (service as any).storageProvider = { save, remove: jest.fn(), createReadStream: jest.fn() };
    mockPrisma.fileAsset.create.mockResolvedValue({
      id: BigInt(10), fileName: 'product.jpg', originalName: 'product.jpg',
      filePath: '/uploads/public/product.jpg', fileSize: BigInt(16), fileType: 'image',
      mimeType: 'image/jpeg', storageType: 1, url: '/uploads/public/product.jpg',
      groupName: 'product', uploaderId: BigInt(1), uploaderType: 'admin',
    });

    const result = await service.uploadFile({
      originalname: 'product.jpg',
      mimetype: 'image/jpeg',
      buffer: Buffer.from([0xFF, 0xD8, 0xFF, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]),
      size: 16,
    } as Express.Multer.File, '1', 'admin', 'product');

    expect(save).toHaveBeenCalledWith(expect.anything(), expect.stringMatching(/\.jpg$/), 'public');
    expect(result.url).toContain('/uploads/public/product.jpg');
  });

  it('敏感组保存到 private，上传响应为鉴权 API URL', async () => {
    const save = jest.fn().mockResolvedValue({ filePath: '/uploads/private/refund.jpg', url: null });
    (service as any).storageProvider = { save, remove: jest.fn(), createReadStream: jest.fn() };
    mockPrisma.fileAsset.create.mockResolvedValue({
      id: BigInt(11), fileName: 'refund.jpg', originalName: 'refund.jpg',
      filePath: '/uploads/private/refund.jpg', fileSize: BigInt(16), fileType: 'image',
      mimeType: 'image/jpeg', storageType: 1, url: null,
      groupName: 'aftersale', uploaderId: BigInt(1), uploaderType: 'user',
    });

    const result = await service.uploadFile({
      originalname: 'refund.jpg',
      mimetype: 'image/jpeg',
      buffer: Buffer.from([0xFF, 0xD8, 0xFF, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]),
      size: 16,
    } as Express.Multer.File, '1', 'user', ' afterSALE ');

    expect(save).toHaveBeenCalledWith(expect.anything(), expect.stringMatching(/\.jpg$/), 'private');
    expect(result.url).toBe('/api/common/file/private/11');
    expect(result.url).not.toContain('/uploads/private/');
  });

  it('findPublicById 拒绝 private 路径和敏感组大小写变体', async () => {
    mockPrisma.fileAsset.findFirst.mockResolvedValue({
      id: BigInt(12), fileName: 'cert.jpg', originalName: 'cert.jpg',
      filePath: '/uploads/private/cert.jpg', fileSize: BigInt(16), fileType: 'image',
      mimeType: 'image/jpeg', storageType: 1, url: null,
      groupName: ' Cert ', uploaderId: BigInt(1), uploaderType: 'admin',
    });

    await expect(service.findPublicById('12')).rejects.toThrow(ForbiddenException);
  });

  it('findPrivateById 仅允许所属用户或管理员访问', async () => {
    const stream = fs.createReadStream(__filename);
    const createReadStream = jest.fn().mockReturnValue(stream);
    (service as any).storageProvider = { save: jest.fn(), remove: jest.fn(), createReadStream };
    mockPrisma.fileAsset.findFirst.mockResolvedValue({
      id: BigInt(13), fileName: 'refund.jpg', originalName: 'refund.jpg',
      filePath: '/uploads/private/refund.jpg', fileSize: BigInt(16), fileType: 'image',
      mimeType: 'image/jpeg', storageType: 1, url: null,
      groupName: 'aftersale', uploaderId: BigInt(9), uploaderType: 'user',
    });

    await expect(service.findPrivateById('13', { id: '8', roleType: 'user' })).rejects.toThrow(ForbiddenException);
    await expect(service.findPrivateById('13', { id: '9', roleType: 'user' })).resolves.toMatchObject({ mimeType: 'image/jpeg' });
    await expect(service.findPrivateById('13', { id: '1', roleType: 'admin' })).resolves.toMatchObject({ mimeType: 'image/jpeg' });
  });
});
