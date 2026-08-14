import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateContentDto } from './dto/create-content.dto';
import { UpdateContentDto } from './dto/update-content.dto';
import { PublicRelatedContentService } from './public-related-content.service';

const MAX_SIGNED_BIGINT = 9223372036854775807n;
const CONTENT_CREATE_EVENT = 'content_create';
const SERIALIZABLE_RETRY_LIMIT = 3;

@Injectable()
export class DurableContentMutationService extends PublicRelatedContentService {
  private readonly mutationLogger = new Logger(DurableContentMutationService.name);

  constructor(private readonly durablePrisma: PrismaService) {
    super(durablePrisma);
  }

  override async create(data: CreateContentDto) {
    const relatedProductIds = this.normalizeRelatedProductIds(data.relatedProductIds);
    const requestId = data.clientRequestId?.trim() || null;
    const contentType = data.contentType || 'article';
    const status = data.status ?? 2;
    const normalized = {
      title: data.title.trim(),
      contentType,
      coverImage: data.coverImage ?? null,
      content: data.content ?? '',
      summary: data.summary ?? null,
      videoUrl: data.videoUrl || null,
      videoCover: data.videoCover || null,
      videoDuration: data.videoDuration ?? null,
      placement: data.placement ?? null,
      tags: data.tags ?? null,
      relatedProductIds: relatedProductIds ?? null,
      relatedActivityId: data.relatedActivityId
        ? this.parseMutationId(data.relatedActivityId, '关联活动')
        : null,
      isFeatured: data.isFeatured ?? 0,
      sortOrder: data.sortOrder ?? 0,
      status,
      categoryId: data.categoryId
        ? this.parseMutationId(data.categoryId, '内容分类')
        : null,
    };

    if (contentType === 'article') {
      normalized.videoUrl = null;
      normalized.videoCover = null;
      normalized.videoDuration = null;
    }
    this.assertMutationContentIntegrity(normalized);

    const fingerprint = this.createFingerprint(normalized);

    for (let attempt = 0; attempt < SERIALIZABLE_RETRY_LIMIT; attempt += 1) {
      try {
        const result = await this.durablePrisma.$transaction(
          async (tx) => {
            if (requestId) {
              const handled = await tx.businessEvent.findFirst({
                where: {
                  eventType: CONTENT_CREATE_EVENT,
                  bizType: 'content',
                  bizId: requestId,
                },
                orderBy: { id: 'desc' },
              });
              if (handled) {
                const eventPayload = this.readCreateEventPayload(handled.payload);
                if (eventPayload.fingerprint !== fingerprint) {
                  throw new BadRequestException('内容创建请求ID已被其他操作使用，请重新提交');
                }
                const replay = await tx.content.findFirst({
                  where: { id: this.parseMutationId(eventPayload.contentId, '内容') },
                });
                if (!replay) {
                  throw new BadRequestException('该内容创建请求已处理，但内容记录不存在，请刷新内容列表后重试');
                }
                if (replay.deletedAt) {
                  throw new BadRequestException('该内容创建请求已处理，但内容已删除，请刷新内容列表');
                }
                return { content: replay, replayed: true };
              }
            }

            if (normalized.categoryId !== null) {
              const category = await tx.contentCategory.findFirst({
                where: { id: normalized.categoryId, status: 1 },
                select: { id: true },
              });
              if (!category) {
                throw new BadRequestException('内容分类不存在或已停用');
              }
            }

            const content = await tx.content.create({
              data: {
                ...normalized,
                placement: this.toDatabaseJson(normalized.placement),
                tags: this.toDatabaseJson(normalized.tags),
                relatedProductIds: this.toDatabaseJson(normalized.relatedProductIds),
                publishedAt: status === 1 ? new Date() : null,
              },
            });

            if (requestId) {
              await tx.businessEvent.create({
                data: {
                  eventType: CONTENT_CREATE_EVENT,
                  bizType: 'content',
                  bizId: requestId,
                  level: 'info',
                  message: '内容创建请求已处理',
                  payload: {
                    contentId: content.id.toString(),
                    fingerprint,
                  },
                },
              });
            }

            return { content, replayed: false };
          },
          { isolationLevel: 'Serializable' },
        );

        this.mutationLogger.log(
          `创建内容：${result.content.id}${result.replayed ? '（幂等重放）' : ''}`,
        );
        return this.serializeContentResult(result.content);
      } catch (error: any) {
        if (error?.code === 'P2034' && attempt + 1 < SERIALIZABLE_RETRY_LIMIT) continue;
        throw error;
      }
    }

    throw new Error('内容创建事务重试次数已耗尽');
  }

  override async update(id: string, data: UpdateContentDto) {
    const normalizedData: any = { ...data };
    if (data.relatedProductIds !== undefined) {
      const relatedProductIds = this.normalizeRelatedProductIds(data.relatedProductIds);
      normalizedData.relatedProductIds = relatedProductIds === null
        ? Prisma.DbNull
        : relatedProductIds;
    }
    if (data.placement === null) normalizedData.placement = Prisma.DbNull;
    if (data.tags === null) normalizedData.tags = Prisma.DbNull;
    return super.update(id, normalizedData);
  }

  override async delete(id: string) {
    const contentId = this.parseMutationId(id, '内容');
    const result = await this.durablePrisma.$transaction(async (tx) => {
      const existing = await tx.content.findFirst({ where: { id: contentId } });
      if (!existing) throw new NotFoundException('内容不存在');
      if (existing.deletedAt) return { content: existing, replayed: true };

      const deleted = await tx.content.updateMany({
        where: { id: contentId, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      if (deleted.count === 0) {
        const concurrent = await tx.content.findFirst({ where: { id: contentId } });
        if (concurrent?.deletedAt) return { content: concurrent, replayed: true };
        throw new BadRequestException('内容状态已变更，请刷新内容列表后重试');
      }

      const content = await tx.content.findFirst({ where: { id: contentId } });
      if (!content) throw new NotFoundException('内容不存在');
      return { content, replayed: false };
    });

    this.mutationLogger.log(`删除内容：${id}${result.replayed ? '（幂等重放）' : ''}`);
    return this.serializeContentResult(result.content);
  }

  private normalizeRelatedProductIds(
    value: string[] | null | undefined,
  ): string[] | null | undefined {
    if (value === undefined || value === null) return value;
    return value.map((id) => this.parseMutationId(id, '关联商品').toString());
  }

  private toDatabaseJson(value: string[] | null) {
    return value === null ? Prisma.DbNull : value;
  }

  private parseMutationId(value: unknown, label: string): bigint {
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

  private assertMutationContentIntegrity(content: {
    title?: unknown;
    contentType?: unknown;
    content?: unknown;
    videoUrl?: unknown;
    status?: unknown;
  }) {
    if (typeof content.title !== 'string' || !content.title.trim()) {
      throw new BadRequestException('标题不能为空');
    }
    if (content.contentType !== 'article' && content.contentType !== 'video') {
      throw new BadRequestException('内容类型必须为 article 或 video');
    }
    if (
      content.contentType === 'article'
      && (typeof content.content !== 'string' || !content.content.trim())
    ) {
      throw new BadRequestException('文章类型内容必须填写正文内容');
    }
    if (
      content.contentType === 'video'
      && (typeof content.videoUrl !== 'string' || !content.videoUrl.trim())
    ) {
      throw new BadRequestException('视频类型内容必须上传视频文件');
    }
    if (content.status !== 1 && content.status !== 2) {
      throw new BadRequestException('内容状态必须为发布或草稿');
    }
  }

  private createFingerprint(data: {
    title: string;
    contentType: string;
    coverImage: string | null;
    content: string;
    summary: string | null;
    videoUrl: string | null;
    videoCover: string | null;
    videoDuration: number | null;
    placement: string[] | null;
    tags: string[] | null;
    relatedProductIds: string[] | null;
    relatedActivityId: bigint | null;
    isFeatured: number;
    sortOrder: number;
    status: number;
    categoryId: bigint | null;
  }) {
    return JSON.stringify({
      title: data.title,
      contentType: data.contentType,
      coverImage: data.coverImage,
      content: data.content,
      summary: data.summary,
      videoUrl: data.videoUrl,
      videoCover: data.videoCover,
      videoDuration: data.videoDuration,
      placement: data.placement,
      tags: data.tags,
      relatedProductIds: data.relatedProductIds,
      relatedActivityId: data.relatedActivityId?.toString() ?? null,
      isFeatured: data.isFeatured,
      sortOrder: data.sortOrder,
      status: data.status,
      categoryId: data.categoryId?.toString() ?? null,
    });
  }

  private readCreateEventPayload(payload: unknown): { contentId: string; fingerprint: string } {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new BadRequestException('内容创建请求记录异常，请刷新内容列表后重试');
    }
    const record = payload as Record<string, unknown>;
    const contentId = typeof record.contentId === 'string' ? record.contentId : '';
    const fingerprint = typeof record.fingerprint === 'string' ? record.fingerprint : '';
    if (!/^[1-9]\d*$/.test(contentId) || !fingerprint) {
      throw new BadRequestException('内容创建请求记录异常，请刷新内容列表后重试');
    }
    return { contentId, fingerprint };
  }

  private serializeContentResult(content: any) {
    return (this as any).serializeContent(content);
  }
}
