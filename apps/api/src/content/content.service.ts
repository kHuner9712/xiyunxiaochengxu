import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ContentQueryDto } from './dto/content-query.dto';
import { CreateContentDto } from './dto/create-content.dto';
import { UpdateContentDto } from './dto/update-content.dto';
import { paginate } from '@baby-mall/shared';
import { getAssetBaseUrl, normalizeAssetUrl } from '../common/utils/asset-url';

const MAX_SIGNED_BIGINT = 9223372036854775807n;

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
    if (dto.categoryId) where.categoryId = this.parsePositiveId(dto.categoryId, '内容分类');
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

  async findPublishedById(id: string) {
    const contentId = this.parsePositiveId(id, '内容');
    const content = await this.prisma.content.findFirst({
      where: { id: contentId, status: 1, deletedAt: null },
      include: { category: { select: { id: true, name: true } } },
    });
    if (!content) throw new NotFoundException('内容不存在或未发布');

    await this.prisma.content.update({
      where: { id: contentId },
      data: { viewCount: { increment: 1 } },
    });

    return this.serializeContent({
      ...content,
      viewCount: Number(content.viewCount || 0) + 1,
    });
  }

  async findAdminById(id: string) {
    const contentId = this.parsePositiveId(id, '内容');
    const content = await this.prisma.content.findFirst({
      where: { id: contentId, deletedAt: null },
      include: { category: { select: { id: true, name: true } } },
    });
    if (!content) throw new NotFoundException('内容不存在');
    return this.serializeContent(content);
  }

  /** @deprecated Use findPublishedById for public reads or findAdminById for admin reads. */
  async findById(id: string) {
    return this.findPublishedById(id);
  }

  async findAllAdmin(dto: ContentQueryDto) {
    const where: any = { deletedAt: null };
    if (dto.categoryId) where.categoryId = this.parsePositiveId(dto.categoryId, '内容分类');
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

  async create(data: CreateContentDto) {
    const contentType = data.contentType || 'article';
    const status = data.status ?? 2;
    const normalized: any = {
      ...data,
      contentType,
      status,
      content: data.content ?? '',
      videoUrl: data.videoUrl || null,
      videoCover: data.videoCover || null,
      videoDuration: data.videoDuration ?? null,
    };

    if (contentType === 'article') {
      normalized.videoUrl = null;
      normalized.videoCover = null;
      normalized.videoDuration = null;
    }
    this.assertContentIntegrity(normalized);

    const categoryId = await this.resolveCategoryId(data.categoryId);
    const createData: any = {
      title: data.title.trim(),
      contentType,
      coverImage: data.coverImage,
      content: normalized.content,
      summary: data.summary,
      videoUrl: normalized.videoUrl,
      videoCover: normalized.videoCover,
      videoDuration: normalized.videoDuration,
      placement: data.placement,
      tags: data.tags,
      relatedProductIds: data.relatedProductIds,
      relatedActivityId: data.relatedActivityId
        ? this.parsePositiveId(data.relatedActivityId, '关联活动')
        : null,
      isFeatured: data.isFeatured ?? 0,
      sortOrder: data.sortOrder ?? 0,
      status,
      categoryId,
      publishedAt: status === 1 ? new Date() : null,
    };

    const content = await this.prisma.content.create({ data: createData });
    this.logger.log(`创建内容：${content.id}`);
    return this.serializeContent(content);
  }

  async update(id: string, data: UpdateContentDto) {
    const contentId = this.parsePositiveId(id, '内容');
    const content = await this.prisma.content.findFirst({
      where: { id: contentId, deletedAt: null },
    });
    if (!content) throw new NotFoundException('内容不存在');

    const nextContentType = data.contentType ?? content.contentType ?? 'article';
    const changingToVideo = nextContentType === 'video' && content.contentType !== 'video';
    let nextContent = data.content !== undefined ? (data.content ?? '') : content.content;
    let nextVideoUrl = data.videoUrl !== undefined ? data.videoUrl : content.videoUrl;

    if (changingToVideo && data.content === undefined) {
      nextContent = '';
    }
    if (nextContentType === 'article') {
      nextVideoUrl = null;
    }

    const nextState = {
      title: data.title !== undefined ? data.title : content.title,
      contentType: nextContentType,
      content: nextContent,
      videoUrl: nextVideoUrl,
      status: data.status !== undefined ? data.status : content.status,
    };
    this.assertContentIntegrity(nextState);

    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title.trim();
    if (data.contentType !== undefined) updateData.contentType = nextContentType;
    if (data.coverImage !== undefined) updateData.coverImage = data.coverImage;
    if (data.content !== undefined || changingToVideo) updateData.content = nextContent;
    if (data.summary !== undefined) updateData.summary = data.summary;
    if (data.placement !== undefined) updateData.placement = data.placement;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.relatedProductIds !== undefined) updateData.relatedProductIds = data.relatedProductIds;
    if (data.relatedActivityId !== undefined) {
      updateData.relatedActivityId = data.relatedActivityId
        ? this.parsePositiveId(data.relatedActivityId, '关联活动')
        : null;
    }
    if (data.isFeatured !== undefined) {
      if (data.isFeatured !== 0 && data.isFeatured !== 1) {
        throw new BadRequestException('推荐状态必须为0或1');
      }
      updateData.isFeatured = data.isFeatured;
    }
    if (data.sortOrder !== undefined) {
      if (!Number.isInteger(data.sortOrder) || data.sortOrder < 0) {
        throw new BadRequestException('排序值必须为非负整数');
      }
      updateData.sortOrder = data.sortOrder;
    }
    if (data.status !== undefined) updateData.status = data.status;
    if (data.categoryId !== undefined) {
      if (data.categoryId === null || data.categoryId === '') {
        updateData.categoryId = null;
      } else {
        const requestedCategoryId = this.parsePositiveId(data.categoryId, '内容分类');
        updateData.categoryId = content.categoryId === requestedCategoryId
          ? requestedCategoryId
          : await this.resolveCategoryId(data.categoryId);
      }
    }

    if (nextContentType === 'article') {
      updateData.videoUrl = null;
      updateData.videoCover = null;
      updateData.videoDuration = null;
    } else {
      if (data.videoUrl !== undefined) updateData.videoUrl = data.videoUrl;
      if (data.videoCover !== undefined) updateData.videoCover = data.videoCover;
      if (data.videoDuration !== undefined) updateData.videoDuration = data.videoDuration;
    }

    if (data.status === 1 && !content.publishedAt) {
      updateData.publishedAt = new Date();
    }

    const result = await this.prisma.content.update({
      where: { id: contentId },
      data: updateData,
    });
    this.logger.log(`更新内容：${id}`);
    return this.serializeContent(result);
  }

  async delete(id: string) {
    const contentId = this.parsePositiveId(id, '内容');
    const content = await this.prisma.content.findFirst({ where: { id: contentId, deletedAt: null } });
    if (!content) throw new NotFoundException('内容不存在');

    const result = await this.prisma.content.update({
      where: { id: contentId },
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
    const categoryId = this.parsePositiveId(id, '内容分类');
    const category = await this.prisma.contentCategory.findFirst({ where: { id: categoryId } });
    if (!category) throw new NotFoundException('分类不存在');
    const result = await this.prisma.contentCategory.update({ where: { id: categoryId }, data });
    this.logger.log(`更新内容分类：${id}`);
    return { ...result, id: result.id.toString() };
  }

  async deleteCategory(id: string) {
    const categoryId = this.parsePositiveId(id, '内容分类');
    const category = await this.prisma.contentCategory.findFirst({ where: { id: categoryId } });
    if (!category) throw new NotFoundException('分类不存在');
    const result = await this.prisma.contentCategory.update({
      where: { id: categoryId },
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

  private async resolveCategoryId(categoryId: unknown): Promise<bigint | null> {
    if (categoryId === undefined || categoryId === null || categoryId === '') {
      return null;
    }

    const id = this.parsePositiveId(categoryId, '内容分类');
    const category = await this.prisma.contentCategory.findFirst({
      where: { id, status: 1 },
      select: { id: true },
    });
    if (!category) {
      throw new BadRequestException('内容分类不存在或已停用');
    }
    return id;
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

  private hasText(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
  }

  private assertContentIntegrity(content: {
    title?: unknown;
    contentType?: unknown;
    content?: unknown;
    videoUrl?: unknown;
    status?: unknown;
  }) {
    if (!this.hasText(content.title)) {
      throw new BadRequestException('标题不能为空');
    }
    if (content.contentType !== 'article' && content.contentType !== 'video') {
      throw new BadRequestException('内容类型必须为 article 或 video');
    }
    if (content.contentType === 'article' && !this.hasText(content.content)) {
      throw new BadRequestException('文章类型内容必须填写正文内容');
    }
    if (content.contentType === 'video' && !this.hasText(content.videoUrl)) {
      throw new BadRequestException('视频类型内容必须上传视频文件');
    }
    if (content.status !== 1 && content.status !== 2) {
      throw new BadRequestException('内容状态必须为发布或草稿');
    }
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
      videoUrl: normalizeAssetUrl(c.videoUrl, this.assetBaseUrl),
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
