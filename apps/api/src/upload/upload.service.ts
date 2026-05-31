import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { paginate } from '@baby-mall/shared';
import * as path from 'path';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import { normalizeAssetUrl } from '../common/utils/asset-url';

const FILE_MAGIC_NUMBERS: Record<string, number[][]> = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png': [[0x89, 0x50, 0x4E, 0x47]],
  'image/gif': [[0x47, 0x49, 0x46]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]],
  'image/bmp': [[0x42, 0x4D]],
  'video/mp4': [[0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70], [0x00, 0x00, 0x00, 0x1C, 0x66, 0x74, 0x79, 0x70], [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70]],
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]],
};

export const MIME_TO_EXTENSIONS: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'image/bmp': ['.bmp'],
  'video/mp4': ['.mp4'],
  'application/pdf': ['.pdf'],
};

const DEFAULT_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
];

export function parseAllowedMimeTypes(): string[] {
  const envValue = process.env.UPLOAD_ALLOWED_TYPES;
  if (!envValue) return DEFAULT_ALLOWED_MIME_TYPES;
  return envValue.split(',').map(t => t.trim()).filter(Boolean);
}

export function getAllowedExtensions(allowedMimes: string[]): string[] {
  const extensions: string[] = [];
  for (const mime of allowedMimes) {
    const exts = MIME_TO_EXTENSIONS[mime];
    if (exts) extensions.push(...exts);
  }
  return extensions;
}

type UploadVisibility = 'public' | 'private';

interface StorageProvider {
  save(file: Express.Multer.File, targetFileName: string, visibility: UploadVisibility): Promise<{ filePath: string; url: string | null }>;
  remove(filePath: string): Promise<void>;
  createReadStream(filePath: string): Promise<fs.ReadStream>;
}

class LocalStorageProvider implements StorageProvider {
  private readonly uploadDir: string;

  constructor() {
    this.uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
  }

  async save(file: Express.Multer.File, targetFileName: string, visibility: UploadVisibility) {
    const targetDir = path.join(this.uploadDir, visibility);
    await fsp.mkdir(targetDir, { recursive: true });
    const filePath = path.join(targetDir, targetFileName);
    await fsp.writeFile(filePath, file.buffer);
    const publicPath = `/uploads/${visibility}/${targetFileName}`;
    return {
      filePath: publicPath,
      url: visibility === 'public' ? publicPath : null,
    };
  }

  async remove(filePath: string) {
    const fullPath = this.resolveStoredPath(filePath);
    try {
      await fsp.unlink(fullPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async createReadStream(filePath: string) {
    const fullPath = this.resolveStoredPath(filePath);
    try {
      await fsp.access(fullPath, fs.constants.F_OK);
    } catch {
      throw new NotFoundException('文件不存在');
    }
    return fs.createReadStream(fullPath);
  }

  private resolveStoredPath(filePath: string) {
    const normalizedUploadDir = path.resolve(this.uploadDir);
    const storedPath = (filePath || '').replace(/\\/g, '/');
    const uploadPrefix = '/uploads/';
    const relativePath = storedPath.startsWith(uploadPrefix) ? storedPath.slice(uploadPrefix.length) : path.basename(storedPath);
    const fullPath = path.resolve(normalizedUploadDir, relativePath);
    if (!fullPath.startsWith(`${normalizedUploadDir}${path.sep}`) && fullPath !== normalizedUploadDir) {
      throw new BadRequestException('非法文件路径');
    }
    return fullPath;
  }
}

export const SENSITIVE_GROUP_NAMES = ['aftersale', 'admin', 'cert', 'business_license', 'private'];

export function normalizeGroupName(groupName?: string | null): string | null {
  const normalized = (groupName || '').trim().toLowerCase();
  return normalized || null;
}

export function isSensitiveGroup(groupName?: string | null): boolean {
  const normalized = normalizeGroupName(groupName);
  return !!normalized && SENSITIVE_GROUP_NAMES.includes(normalized);
}

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly storageProvider: StorageProvider;
  private readonly allowedMimeTypes: string[];
  private readonly allowedExtensions: string[];

  constructor(private prisma: PrismaService) {
    this.storageProvider = new LocalStorageProvider();
    this.allowedMimeTypes = parseAllowedMimeTypes();
    this.allowedExtensions = getAllowedExtensions(this.allowedMimeTypes);
  }

  async uploadFile(file: Express.Multer.File, uploaderId: string, uploaderType: string, groupName?: string) {
    if (!file || !file.originalname) {
      throw new BadRequestException('请选择要上传的文件');
    }
    const maxFileSize = parseInt(process.env.UPLOAD_MAX_SIZE || '10485760', 10);
    if (file.size > maxFileSize) {
      throw new BadRequestException(`文件大小超过限制（最大 ${Math.round(maxFileSize / 1024 / 1024)}MB）`);
    }
    const ext = path.extname(file.originalname).toLowerCase();
    if (!this.allowedExtensions.includes(ext)) {
      throw new BadRequestException(`不支持的文件类型: ${ext}，仅允许: ${this.allowedExtensions.join(', ')}`);
    }
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(`不支持的MIME类型: ${file.mimetype}`);
    }
    this.validateFileMagic(file);

    const normalizedGroupName = normalizeGroupName(groupName);
    const visibility: UploadVisibility = isSensitiveGroup(normalizedGroupName) ? 'private' : 'public';
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
    const stored = await this.storageProvider.save(file, fileName, visibility);

    const fileType = file.mimetype.startsWith('image/')
      ? 'image'
      : file.mimetype.startsWith('video/')
        ? 'video'
        : 'document';

    const fileAsset = await this.prisma.fileAsset.create({
      data: {
        fileName,
        originalName: file.originalname,
        filePath: stored.filePath,
        fileSize: BigInt(file.size),
        fileType,
        mimeType: file.mimetype,
        storageType: 1,
        url: stored.url,
        groupName: normalizedGroupName,
        uploaderId: BigInt(uploaderId),
        uploaderType,
      },
    });

    this.logger.log(`上传文件：${fileName}，类型：${fileType}`);
    return this.serializeFileAsset(fileAsset);
  }

  async findById(id: string) {
    const file = await this.prisma.fileAsset.findFirst({
      where: { id: BigInt(id) },
    });
    if (!file) throw new NotFoundException('文件不存在');
    return this.serializeFileAsset(file);
  }

  async findPublicById(id: string) {
    const file = await this.prisma.fileAsset.findFirst({
      where: { id: BigInt(id) },
    });
    if (!file) throw new NotFoundException('文件不存在');
    if (this.isPrivateFile(file)) {
      throw new ForbiddenException('该文件不允许公开访问');
    }
    return {
      id: file.id.toString(),
      url: normalizeAssetUrl(file.url || file.filePath),
      fileType: file.fileType,
      mimeType: file.mimeType,
    };
  }

  async findAll(dto: PaginationDto & { groupName?: string; fileType?: string }) {
    const where: any = {};
    if (dto.groupName) where.groupName = dto.groupName;
    if (dto.fileType) where.fileType = dto.fileType;

    const [list, total] = await Promise.all([
      this.prisma.fileAsset.findMany({
        where,
        skip: dto.skip,
        take: dto.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.fileAsset.count({ where }),
    ]);

    return paginate(list.map((f) => this.serializeFileAsset(f)), total, dto.page, dto.pageSize);
  }

  async delete(id: string) {
    const file = await this.prisma.fileAsset.findFirst({ where: { id: BigInt(id) } });
    if (!file) throw new NotFoundException('文件不存在');

    await this.storageProvider.remove(file.filePath);

    await this.prisma.fileAsset.delete({ where: { id: BigInt(id) } });
    this.logger.log(`删除文件：${file.fileName}`);
    return { success: true };
  }

  async findPrivateById(id: string, currentUser: { id?: string; roleType?: string }) {
    const file = await this.prisma.fileAsset.findFirst({
      where: { id: BigInt(id) },
    });
    if (!file) throw new NotFoundException('文件不存在');
    if (!this.isPrivateFile(file)) {
      throw new ForbiddenException('该文件不是私有文件');
    }

    const isAdmin = currentUser?.roleType === 'admin';
    const isOwner = file.uploaderType === 'user'
      && file.uploaderId?.toString() === currentUser?.id?.toString();
    if (!isAdmin && !isOwner) {
      throw new ForbiddenException('无权访问该文件');
    }

    return {
      file: this.serializeFileAsset(file),
      stream: await this.storageProvider.createReadStream(file.filePath),
      mimeType: file.mimeType || 'application/octet-stream',
      fileName: file.originalName || file.fileName || 'file',
    };
  }

  private validateFileMagic(file: Express.Multer.File): void {
    const magicNumbers = FILE_MAGIC_NUMBERS[file.mimetype];
    if (!magicNumbers || !file.buffer || file.buffer.length < 12) return;
    const header = Array.from(file.buffer.slice(0, 12));
    const isValid = magicNumbers.some(magic =>
      magic.every((byte, index) => {
        if (byte === 0x00) return true;
        return header[index] === byte;
      })
    );
    if (!isValid) {
      throw new BadRequestException(`文件内容与声明类型 ${file.mimetype} 不匹配`);
    }
  }

  private isPrivateFile(file: any): boolean {
    const storedPath = String(file.filePath || file.url || '').replace(/\\/g, '/');
    return isSensitiveGroup(file.groupName) || storedPath.startsWith('/uploads/private/') || !storedPath.startsWith('/uploads/public/');
  }

  private serializeFileAsset(file: any) {
    const privateFile = this.isPrivateFile(file);
    const url = privateFile
      ? `/api/common/file/private/${file.id.toString()}`
      : normalizeAssetUrl(file.url || file.filePath);
    return {
      ...file,
      id: file.id.toString(),
      fileSize: file.fileSize?.toString(),
      uploaderId: file.uploaderId?.toString(),
      url,
      filePath: file.filePath || '',
    };
  }
}
