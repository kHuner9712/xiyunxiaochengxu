import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { paginate } from '@baby-mall/shared';
import * as path from 'path';
import * as fs from 'fs';
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

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  'video/mp4',
  'application/pdf',
];

const ALLOWED_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp',
  '.mp4',
  '.pdf',
];

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(private prisma: PrismaService) {}

  async uploadFile(file: Express.Multer.File, uploaderId: string, uploaderType: string, groupName?: string) {
    if (!file || !file.originalname) {
      throw new BadRequestException('请选择要上传的文件');
    }
    const maxFileSize = parseInt(process.env.UPLOAD_MAX_SIZE || '10485760', 10);
    if (file.size > maxFileSize) {
      throw new BadRequestException(`文件大小超过限制（最大 ${Math.round(maxFileSize / 1024 / 1024)}MB）`);
    }
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      throw new BadRequestException(`不支持的文件类型: ${ext}，仅允许图片、视频和PDF`);
    }
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(`不支持的MIME类型: ${file.mimetype}`);
    }
    this.validateFileMagic(file);

    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
    const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, fileName);
    fs.writeFileSync(filePath, file.buffer);

    const fileType = file.mimetype.startsWith('image/')
      ? 'image'
      : file.mimetype.startsWith('video/')
        ? 'video'
        : 'document';

    const fileAsset = await this.prisma.fileAsset.create({
      data: {
        fileName,
        originalName: file.originalname,
        filePath: `/uploads/${fileName}`,
        fileSize: BigInt(file.size),
        fileType,
        mimeType: file.mimetype,
        storageType: 1,
        url: `/uploads/${fileName}`,
        groupName: groupName || null,
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

    const fullPath = path.join(process.cwd(), file.filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    await this.prisma.fileAsset.delete({ where: { id: BigInt(id) } });
    this.logger.log(`删除文件：${file.fileName}`);
    return { success: true };
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

  private serializeFileAsset(file: any) {
    return {
      ...file,
      id: file.id.toString(),
      fileSize: file.fileSize?.toString(),
      uploaderId: file.uploaderId?.toString(),
      url: normalizeAssetUrl(file.url || file.filePath),
      filePath: file.filePath || '',
    };
  }
}
