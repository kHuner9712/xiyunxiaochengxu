import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { paginate } from '@baby-mall/shared';
import * as path from 'path';
import * as fs from 'fs';

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

const ALLOWED_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp',
  '.mp4', '.webm',
  '.pdf',
  '.doc', '.docx',
  '.xls', '.xlsx',
];

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(private prisma: PrismaService) {}

  async uploadFile(file: Express.Multer.File, uploaderId: string, uploaderType: string, groupName?: string) {
    if (!file || !file.originalname) {
      throw new BadRequestException('请选择要上传的文件');
    }
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      throw new BadRequestException(`不支持的文件类型: ${ext}，仅允许图片、视频、PDF和Office文档`);
    }
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(`不支持的MIME类型: ${file.mimetype}`);
    }

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

  private serializeFileAsset(file: any) {
    return {
      ...file,
      id: file.id.toString(),
      fileSize: file.fileSize?.toString(),
      uploaderId: file.uploaderId?.toString(),
    };
  }
}
