import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ContentQueryDto } from './dto/content-query.dto';
import { paginate } from '@baby-mall/shared';
import { getAssetBaseUrl, normalizeAssetUrl } from '../common/utils/asset-url';

@Injectable()
export class ContentService {
  private readonly logger = new Logger(ContentService.name);
  private readonly assetBaseUrl = getAssetBaseUrl();

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
    if (dto.contentType) where.contentType = dto.contentType;
    if (dto.placement) where.placement = { array_contains: dto.placement };
    if (dto.keyword) where.OR = [
      { title: { contains: dto.keyword } },
      { summary: { contains: dto.keyword } },
    ];

    const [list, total] = await Promise.all([
      this.prisma.content.findMany({
        where,
        skip: dto.skip,
        take: dto.take,
        orderBy: { publishedAt: 'desc' },
        include: { category: { select: { id: true, name: true } } },
      }),
      this.prisma.content.count({ where }),
    ]);

    return paginate(
      list.map((c) => this.serializeContent(c)),
      total,
      dto.page,
      dto.pageSize,
    );
  }

  async findById(id: string) {
    const content = await this.prisma.content.findFirst({
      where: { id: BigInt(id), deletedAt: null },
      include: { category: { select: { id: true, name: true } } },
    });
    if (!content) throw new NotFoundException('内容不存在');

    await this.prisma.content.update({
      where: { id: BigInt(id) },
      data: { viewCount: { increment: 1 } },
    });

    return this.serializeContent(content);
  }

  async findAllAdmin(dto: ContentQueryDto) {
    const where: any = { deletedAt: null };
    if (dto.categoryId) where.categoryId = BigInt(dto.categoryId);
    if (dto.status !== undefined) where.status = dto.status;
    if (dto.title) where.title = { contains: dto.title };
    if (dto.contentType) where.contentType = dto.contentType;
    if (dto.placement) where.placement = { array_contains: dto.placement };

    const [list, total] = await Promise.all([
      this.prisma.content.findMany({
        where,
        skip: dto.skip,
        take: dto.take,
        orderBy: { createdAt: 'desc' },
        include: { category: { select: { id: true, name: true } } },
      }),
      this.prisma.content.count({ where }),
    ]);

    return paginate(
      list.map((c) => this.serializeContent(c)),
      total,
      dto.page,
      dto.pageSize,
    );
  }

  async create(data: any) {
    if (data.contentType === 'video' && !data.videoUrl) {
      throw new BadRequestException('视频类型内容必须填写视频链接');
    }

    const createData: any = {
      title: data.title,
      contentType: data.contentType || 'article',
      coverImage: data.coverImage,
      content: data.content,
      summary: data.summary,
      videoUrl: data.videoUrl,
      videoCover: data.videoCover,
      videoDuration: data.videoDuration,
      placement: data.placement,
      tags: data.tags,
      relatedProductIds: data.relatedProductIds,
      relatedActivityId: data.relatedActivityId ? BigInt(data.relatedActivityId) : null,
      isFeatured: data.isFeatured ?? 0,
      sortOrder: data.sortOrder ?? 0,
      status: data.status ?? 2,
      categoryId: data.categoryId ? BigInt(data.categoryId) : null,
      publishedAt: data.status === 1 ? new Date() : null,
    };

    const content = await this.prisma.content.create({ data: createData });
    this.logger.log(`创建内容：${content.id}`);
    return this.serializeContent(content);
  }

  async update(id: string, data: any) {
    const content = await this.prisma.content.findFirst({ where: { id: BigInt(id), deletedAt: null } });
    if (!content) throw new NotFoundException('内容不存在');

    if (data.contentType === 'video' && !data.videoUrl && !content.videoUrl) {
      throw new BadRequestException('视频类型内容必须填写视频链接');
    }

    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.contentType !== undefined) updateData.contentType = data.contentType;
    if (data.coverImage !== undefined) updateData.coverImage = data.coverImage;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.summary !== undefined) updateData.summary = data.summary;
    if (data.videoUrl !== undefined) updateData.videoUrl = data.videoUrl;
    if (data.videoCover !== undefined) updateData.videoCover = data.videoCover;
    if (data.videoDuration !== undefined) updateData.videoDuration = data.videoDuration;
    if (data.placement !== undefined) updateData.placement = data.placement;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.relatedProductIds !== undefined) updateData.relatedProductIds = data.relatedProductIds;
    if (data.relatedActivityId !== undefined) updateData.relatedActivityId = data.relatedActivityId ? BigInt(data.relatedActivityId) : null;
    if (data.isFeatured !== undefined) updateData.isFeatured = data.isFeatured;
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.categoryId !== undefined) updateData.categoryId = data.categoryId ? BigInt(data.categoryId) : null;

    if (data.status === 1 && !content.publishedAt) {
      updateData.publishedAt = new Date();
    }

    const result = await this.prisma.content.update({
      where: { id: BigInt(id) },
      data: updateData,
    });
    this.logger.log(`更新内容：${id}`);
    return this.serializeContent(result);
  }

  async delete(id: string) {
    const content = await this.prisma.content.findFirst({ where: { id: BigInt(id), deletedAt: null } });
    if (!content) throw new NotFoundException('内容不存在');

    const result = await this.prisma.content.update({
      where: { id: BigInt(id) },
      data: { deletedAt: new Date() },
    });
    this.logger.log(`删除内容：${id}`);
    return this.serializeContent(result);
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

  async findActivityFeed(tab: string, page: number, pageSize: number) {
    if (tab === 'recommend') {
      return this.getRecommendFeed(page, pageSize);
    } else if (tab === 'discount') {
      return this.getDiscountFeed(page, pageSize);
    } else if (tab === 'video') {
      return this.getContentByType('video', page, pageSize);
    } else if (tab === 'article') {
      return this.getContentByType('article', page, pageSize);
    } else if (tab === 'offline') {
      return this.getOfflineFeed(page, pageSize);
    }
    return this.getRecommendFeed(page, pageSize);
  }

  private async getRecommendFeed(page: number, pageSize: number) {
    const now = new Date();
    const skip = (page - 1) * pageSize;

    const [activities, contents] = await Promise.all([
      this.prisma.activity.findMany({
        where: { status: 2, startTime: { lte: now }, endTime: { gte: now } },
        orderBy: { sortOrder: 'asc' },
        take: 5,
        select: { id: true, name: true, type: true, bannerImage: true, startTime: true, endTime: true },
      }),
      this.prisma.content.findMany({
        where: {
          status: 1, deletedAt: null,
          placement: { array_contains: 'activity' },
        },
        orderBy: [{ isFeatured: 'desc' }, { publishedAt: 'desc' }],
        take: 10,
        select: {
          id: true, title: true, contentType: true, coverImage: true, summary: true,
          videoUrl: true, videoCover: true, videoDuration: true, tags: true,
          viewCount: true, publishedAt: true, isFeatured: true,
        },
      }),
    ]);

    const feed = [
      ...activities.map((a) => ({
        type: 'activity' as const,
        id: a.id.toString(),
        title: a.name,
        image: normalizeAssetUrl(a.bannerImage, this.assetBaseUrl),
        startTime: a.startTime,
        endTime: a.endTime,
        activityType: a.type,
        isFeatured: 0,
      })),
      ...contents.map((c) => ({
        type: c.contentType === 'video' ? 'video' as const : 'article' as const,
        id: c.id.toString(),
        title: c.title,
        image: normalizeAssetUrl(c.coverImage, this.assetBaseUrl),
        summary: c.summary,
        contentType: c.contentType,
        videoUrl: c.videoUrl,
        videoCover: normalizeAssetUrl(c.videoCover, this.assetBaseUrl),
        videoDuration: c.videoDuration,
        tags: c.tags,
        viewCount: c.viewCount,
        publishTime: c.publishedAt,
        isFeatured: c.isFeatured,
      })),
    ].sort((a, b) => {
      if (a.isFeatured && !b.isFeatured) return -1;
      if (!a.isFeatured && b.isFeatured) return 1;
      return 0;
    });

    const total = feed.length;
    const paged = feed.slice(skip, skip + pageSize);

    return paginate(paged, total, page, pageSize);
  }

  private async getDiscountFeed(page: number, pageSize: number) {
    const now = new Date();
    const where = { status: 2, startTime: { lte: now }, endTime: { gte: now } };

    const [list, total] = await Promise.all([
      this.prisma.activity.findMany({
        where, orderBy: { sortOrder: 'asc' },
        skip: (page - 1) * pageSize, take: pageSize,
        select: { id: true, name: true, type: true, bannerImage: true, startTime: true, endTime: true },
      }),
      this.prisma.activity.count({ where }),
    ]);

    return paginate(
      list.map((a) => ({
        type: 'activity' as const,
        id: a.id.toString(),
        title: a.name,
        image: normalizeAssetUrl(a.bannerImage, this.assetBaseUrl),
        startTime: a.startTime,
        endTime: a.endTime,
        activityType: a.type,
      })),
      total, page, pageSize,
    );
  }

  private async getContentByType(contentType: string, page: number, pageSize: number) {
    const where: any = {
      status: 1, deletedAt: null, contentType,
      placement: { array_contains: 'activity' },
    };

    const [list, total] = await Promise.all([
      this.prisma.content.findMany({
        where,
        orderBy: [{ isFeatured: 'desc' }, { publishedAt: 'desc' }],
        skip: (page - 1) * pageSize, take: pageSize,
        select: {
          id: true, title: true, contentType: true, coverImage: true, summary: true,
          videoUrl: true, videoCover: true, videoDuration: true, tags: true,
          viewCount: true, publishedAt: true, isFeatured: true,
        },
      }),
      this.prisma.content.count({ where }),
    ]);

    return paginate(
      list.map((c) => ({
        type: c.contentType === 'video' ? 'video' as const : 'article' as const,
        id: c.id.toString(),
        title: c.title,
        image: normalizeAssetUrl(c.coverImage, this.assetBaseUrl),
        summary: c.summary,
        contentType: c.contentType,
        videoUrl: c.videoUrl,
        videoCover: normalizeAssetUrl(c.videoCover, this.assetBaseUrl),
        videoDuration: c.videoDuration,
        tags: c.tags,
        viewCount: c.viewCount,
        publishTime: c.publishedAt,
        isFeatured: c.isFeatured,
      })),
      total, page, pageSize,
    );
  }

  private async getOfflineFeed(page: number, pageSize: number) {
    const now = new Date();
    const where = { status: 2, startTime: { lte: now }, endTime: { gte: now }, type: 'offline' };

    const [list, total] = await Promise.all([
      this.prisma.activity.findMany({
        where, orderBy: { sortOrder: 'asc' },
        skip: (page - 1) * pageSize, take: pageSize,
        select: { id: true, name: true, type: true, bannerImage: true, startTime: true, endTime: true },
      }),
      this.prisma.activity.count({ where }),
    ]);

    return paginate(
      list.map((a) => ({
        type: 'activity' as const,
        id: a.id.toString(),
        title: a.name,
        image: normalizeAssetUrl(a.bannerImage, this.assetBaseUrl),
        startTime: a.startTime,
        endTime: a.endTime,
        activityType: a.type,
      })),
      total, page, pageSize,
    );
  }

  private serializeContent(c: any) {
    return {
      id: c.id.toString(),
      categoryId: c.categoryId?.toString(),
      categoryName: c.category?.name || '',
      title: c.title,
      contentType: c.contentType || 'article',
      coverImage: normalizeAssetUrl(c.coverImage, this.assetBaseUrl),
      content: c.content,
      summary: c.summary,
      videoUrl: c.videoUrl,
      videoCover: normalizeAssetUrl(c.videoCover, this.assetBaseUrl),
      videoDuration: c.videoDuration,
      placement: c.placement,
      tags: c.tags,
      relatedProductIds: c.relatedProductIds,
      relatedActivityId: c.relatedActivityId?.toString(),
      isFeatured: c.isFeatured ?? 0,
      viewCount: c.viewCount,
      sortOrder: c.sortOrder,
      status: c.status,
      publishedAt: c.publishedAt,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  }
}
