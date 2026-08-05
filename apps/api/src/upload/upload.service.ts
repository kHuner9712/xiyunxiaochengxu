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
  'image/bmp': [[0x42, 0x4D]],
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
const DEFAULT_UPLOAD_MAX_SIZE = 52428800;
const MP4_SCAN_LIMIT = 1024 * 1024;
const MP4_MAX_BOXES_TO_SCAN = 64;
const MAX_SIGNED_BIGINT = 9223372036854775807n;
const CONTENT_ASSET_GROUPS = new Set(['content-cover', 'content-video', 'content-video-cover']);

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
    const configuredMaxSize = Number.parseInt(process.env.UPLOAD_MAX_SIZE || String(DEFAULT_UPLOAD_MAX_SIZE), 10);
    const maxFileSize = Number.isFinite(configuredMaxSize) && configuredMaxSize > 0
      ? configuredMaxSize
      : DEFAULT_UPLOAD_MAX_SIZE;
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
    const parsedUploaderId = this.parsePositiveId(uploaderId, '上传者');

    const normalizedGroupName = normalizeGroupName(groupName);
    const visibility: UploadVisibility = isSensitiveGroup(normalizedGroupName) ? 'private' : 'public';
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
    const stored = await this.storageProvider.save(file, fileName, visibility);

    try {
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
          uploaderId: parsedUploaderId,
          uploaderType,
        },
      });

      this.logger.log(`上传文件：${fileName}，类型：${fileType}`);
      return this.serializeFileAsset(fileAsset);
    } catch (error) {
      try {
        await this.storageProvider.remove(stored.filePath);
      } catch (cleanupError) {
        this.logger.error(`上传记录写入失败且文件回滚失败：${stored.filePath}`, cleanupError as Error);
      }
      throw error;
    }
  }

  async findById(id: string) {
    const fileId = this.parsePositiveId(id, '文件');
    const file = await this.prisma.fileAsset.findFirst({
      where: { id: fileId },
    });
    if (!file) throw new NotFoundException('文件不存在');
    return this.serializeFileAsset(file);
  }

  async findPublicById(id: string) {
    const fileId = this.parsePositiveId(id, '文件');
    const file = await this.prisma.fileAsset.findFirst({
      where: { id: fileId },
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
    const fileId = this.parsePositiveId(id, '文件');
    const file = await this.prisma.fileAsset.findFirst({ where: { id: fileId } });
    if (!file) throw new NotFoundException('文件不存在');

    await this.storageProvider.remove(file.filePath);
    await this.prisma.fileAsset.delete({ where: { id: fileId } });
    this.logger.log(`删除文件：${file.fileName}`);
    return { success: true };
  }

  async deletePendingContentAsset(id: string, currentAdminId: string) {
    const fileId = this.parsePositiveId(id, '文件');
    const adminId = this.parsePositiveId(currentAdminId, '管理员');
    const file = await this.prisma.fileAsset.findFirst({ where: { id: fileId } });
    if (!file) throw new NotFoundException('文件不存在');

    const normalizedGroupName = normalizeGroupName(file.groupName);
    const ownedByCurrentAdmin = file.uploaderType === 'admin' && file.uploaderId === adminId;
    const isContentAsset = !!normalizedGroupName && CONTENT_ASSET_GROUPS.has(normalizedGroupName);
    const isPublicUpload = !this.isPrivateFile(file) && String(file.filePath || '').startsWith('/uploads/public/');
    if (!ownedByCurrentAdmin || !isContentAsset || !isPublicUpload) {
      throw new ForbiddenException('只能清理当前管理员本人上传且尚未提交的内容素材');
    }

    const referenced = await this.prisma.content.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { coverImage: { endsWith: file.filePath } },
          { videoUrl: { endsWith: file.filePath } },
          { videoCover: { endsWith: file.filePath } },
        ],
      },
      select: { id: true },
    });
    if (referenced) {
      throw new BadRequestException('文件已被内容引用，不能删除');
    }

    return this.delete(fileId.toString());
  }

  async findPrivateById(id: string, currentUser: { id?: string; roleType?: string }) {
    const fileId = this.parsePositiveId(id, '文件');
    const file = await this.prisma.fileAsset.findFirst({
      where: { id: fileId },
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
    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('上传文件内容为空');
    }

    let isValid: boolean;
    if (file.mimetype === 'video/mp4') {
      isValid = this.isIsoBaseMediaFile(file.buffer);
    } else if (file.mimetype === 'image/webp') {
      isValid = this.isWebpFile(file.buffer);
    } else {
      const magicNumbers = FILE_MAGIC_NUMBERS[file.mimetype];
      if (!magicNumbers) return;
      isValid = magicNumbers.some(magic =>
        file.buffer.length >= magic.length
        && magic.every((byte, index) => file.buffer[index] === byte)
      );
    }

    if (!isValid) {
      throw new BadRequestException(`文件内容与声明类型 ${file.mimetype} 不匹配`);
    }
  }

  private isWebpFile(buffer: Buffer): boolean {
    return buffer.length >= 12
      && buffer.toString('ascii', 0, 4) === 'RIFF'
      && buffer.toString('ascii', 8, 12) === 'WEBP';
  }

  private isIsoBaseMediaFile(buffer: Buffer): boolean {
    const scanLimit = Math.min(buffer.length, MP4_SCAN_LIMIT);
    let offset = 0;

    for (let boxCount = 0; boxCount < MP4_MAX_BOXES_TO_SCAN && offset + 8 <= scanLimit; boxCount += 1) {
      const size32 = buffer.readUInt32BE(offset);
      const boxSize = this.readIsoBoxSize(buffer, offset);
      if (boxSize === null || offset + boxSize > buffer.length) return false;

      const boxType = buffer.toString('ascii', offset + 4, offset + 8);
      if (boxType === 'ftyp') {
        const headerSize = size32 === 1 ? 16 : 8;
        const payloadOffset = offset + headerSize;
        if (boxSize < headerSize + 8 || payloadOffset + 8 > buffer.length) return false;
        const majorBrand = buffer.subarray(payloadOffset, payloadOffset + 4);
        return majorBrand.some(byte => byte !== 0);
      }

      offset += boxSize;
      if (offset > scanLimit) return false;
    }

    return false;
  }

  private readIsoBoxSize(buffer: Buffer, offset: number): number | null {
    const size32 = buffer.readUInt32BE(offset);
    if (size32 === 0) {
      return buffer.length - offset;
    }
    if (size32 === 1) {
      if (offset + 16 > buffer.length) return null;
      const extendedSize = buffer.readBigUInt64BE(offset + 8);
      if (extendedSize > BigInt(Number.MAX_SAFE_INTEGER)) return null;
      const boxSize = Number(extendedSize);
      return boxSize >= 16 ? boxSize : null;
    }
    return size32 >= 8 ? size32 : null;
  }

  private parsePositiveId(value: unknown, label: string): bigint {
    const normalized = String(value ?? '').trim();
    if (!/^[1-9]\d*$/.test(normalized)) {
      throw new BadRequestException(`${label}ID无效`);
    }
    const id = BigInt(normalized);
    if (id > MAX_SIGNED_BIGINT) {
      throw new BadRequestException(`${label}ID超出范围`);
    }
    return id;
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
