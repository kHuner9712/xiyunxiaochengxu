import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ContentQueryDto } from './dto/content-query.dto';
import { paginate } from '@baby-mall/shared';

@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);

  constructor(private prisma: PrismaService) {}

  async findCategories() {
    const categories = await this.prisma.contentCategory.findMany({
      where: { status: 1 },
      orderBy: { sortOrder: 'asc' },
    });
    return categories.map((c) => ({ ...c, id: c.id.toString() }));
  }

  async findPublished(dto: ContentQueryDto) {
    const where: any = { status: 1, deletedAt: null };
    if (dto.categoryId) where.categoryId = BigInt(dto.categoryId);
    if (dto.title) where.title = { contains: dto.title };

    const [list, total] = await Promise.all([
      this.prisma.content.findMany({
        where,
        skip: dto.skip,
        take: dto.take,
        orderBy: { publishedAt: 'desc' },
      }),
      this.prisma.content.count({ where }),
    ]);

    return paginate(
      list.map((c) => ({ ...c, id: c.id.toString(), categoryId: c.categoryId?.toString() })),
      total,
      dto.page,
      dto.pageSize,
    );
  }

  async findById(id: string) {
    const content = await this.prisma.content.findFirst({
      where: { id: BigInt(id), deletedAt: null },
    });
    if (!content) throw new NotFoundException('内容不存在');

    await this.prisma.content.update({
      where: { id: BigInt(id) },
      data: { viewCount: { increment: 1 } },
    });

    return { ...content, id: content.id.toString(), categoryId: content.categoryId?.toString() };
  }

  async findAllAdmin(dto: ContentQueryDto) {
    const where: any = { deletedAt: null };
    if (dto.categoryId) where.categoryId = BigInt(dto.categoryId);
    if (dto.status !== undefined) where.status = dto.status;
    if (dto.title) where.title = { contains: dto.title };

    const [list, total] = await Promise.all([
      this.prisma.content.findMany({
        where,
        skip: dto.skip,
        take: dto.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.content.count({ where }),
    ]);

    return paginate(
      list.map((c) => ({ ...c, id: c.id.toString(), categoryId: c.categoryId?.toString() })),
      total,
      dto.page,
      dto.pageSize,
    );
  }

  async create(data: any) {
    const content = await this.prisma.content.create({
      data: {
        ...data,
        categoryId: data.categoryId ? BigInt(data.categoryId) : null,
        publishedAt: data.status === 1 ? new Date() : null,
      },
    });
    this.logger.log(`创建内容：${content.id}`);
    return { ...content, id: content.id.toString(), categoryId: content.categoryId?.toString() };
  }

  async update(id: string, data: any) {
    const content = await this.prisma.content.findFirst({ where: { id: BigInt(id), deletedAt: null } });
    if (!content) throw new NotFoundException('内容不存在');

    const updateData: any = { ...data };
    if (data.categoryId) updateData.categoryId = BigInt(data.categoryId);
    if (data.status === 1 && !content.publishedAt) {
      updateData.publishedAt = new Date();
    }

    const result = await this.prisma.content.update({
      where: { id: BigInt(id) },
      data: updateData,
    });
    this.logger.log(`更新内容：${id}`);
    return { ...result, id: result.id.toString(), categoryId: result.categoryId?.toString() };
  }

  async delete(id: string) {
    const content = await this.prisma.content.findFirst({ where: { id: BigInt(id), deletedAt: null } });
    if (!content) throw new NotFoundException('内容不存在');

    const result = await this.prisma.content.update({
      where: { id: BigInt(id) },
      data: { deletedAt: new Date() },
    });
    this.logger.log(`删除内容：${id}`);
    return { ...result, id: result.id.toString(), categoryId: result.categoryId?.toString() };
  }

  async createCategory(data: { name: string; icon?: string; sortOrder?: number }) {
    const category = await this.prisma.contentCategory.create({ data });
    this.logger.log(`创建内容分类：${category.id}`);
    return { ...category, id: category.id.toString() };
  }

  async updateCategory(id: string, data: any) {
    const category = await this.prisma.contentCategory.findFirst({ where: { id: BigInt(id) } });
    if (!category) throw new NotFoundException('分类不存在');
    const result = await this.prisma.contentCategory.update({ where: { id: BigInt(id) }, data });
    this.logger.log(`更新内容分类：${id}`);
    return { ...result, id: result.id.toString() };
  }

  async deleteCategory(id: string) {
    const category = await this.prisma.contentCategory.findFirst({ where: { id: BigInt(id) } });
    if (!category) throw new NotFoundException('分类不存在');
    const result = await this.prisma.contentCategory.update({
      where: { id: BigInt(id) },
      data: { status: 2 },
    });
    this.logger.log(`删除内容分类：${id}`);
    return { ...result, id: result.id.toString() };
  }
}
