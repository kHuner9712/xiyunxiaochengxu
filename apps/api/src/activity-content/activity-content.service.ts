import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { paginate } from '@baby-mall/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  ActivityContentQueryDto,
  CreateActivityContentDto,
  UpdateActivityContentDto,
} from './dto/activity-content.dto';

@Injectable()
export class ActivityContentService {
  private readonly logger = new Logger(ActivityContentService.name);

  constructor(private prisma: PrismaService) {}

  // ============ 后台 ============

  async findAll(dto: ActivityContentQueryDto) {
    const where = this.buildAdminWhere(dto);

    const [list, total] = await Promise.all([
      this.prisma.activityContent.findMany({
        where,
        skip: dto.skip,
        take: dto.take,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      }),
      this.prisma.activityContent.count({ where }),
    ]);

    this.logger.log(`管理员查询活动内容列表，共${total}条`);
    return paginate(list.map((item) => this.serialize(item)), total, dto.page, dto.pageSize);
  }

  async findById(id: string) {
    const item = await this.prisma.activityContent.findFirst({
      where: { id: BigInt(id), deletedAt: null },
    });
    if (!item) throw new NotFoundException('活动内容不存在');
    return this.serialize(item);
  }

  async create(dto: CreateActivityContentDto) {
    this.validateBusinessRules(dto);
    const data = this.buildCreateData(dto);

    const result = await this.prisma.activityContent.create({ data });
    this.logger.log(`创建活动内容：${result.id} - ${result.title}`);
    return this.serialize(result);
  }

  async update(id: string, dto: UpdateActivityContentDto) {
    const existing = await this.prisma.activityContent.findFirst({
      where: { id: BigInt(id), deletedAt: null },
    });
    if (!existing) throw new NotFoundException('活动内容不存在');

    this.validateBusinessRules(dto, existing);
    const data = this.buildUpdateData(dto, existing);

    const result = await this.prisma.activityContent.update({
      where: { id: BigInt(id) },
      data,
    });

    this.logger.log(`更新活动内容：${id}`);
    return this.serialize(result);
  }

  async updateStatus(id: string, status: number) {
    const existing = await this.prisma.activityContent.findFirst({
      where: { id: BigInt(id), deletedAt: null },
    });
    if (!existing) throw new NotFoundException('活动内容不存在');

    const result = await this.prisma.activityContent.update({
      where: { id: BigInt(id) },
      data: { status },
    });

    this.logger.log(`更新活动内容状态：${id} -> ${status}`);
    return this.serialize(result);
  }

  async softDelete(id: string) {
    const existing = await this.prisma.activityContent.findFirst({
      where: { id: BigInt(id), deletedAt: null },
    });
    if (!existing) throw new NotFoundException('活动内容不存在');

    const result = await this.prisma.activityContent.update({
      where: { id: BigInt(id) },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`软删除活动内容：${id}`);
    return this.serialize(result);
  }

  // ============ 小程序 ============

  async findWeappList(dto: ActivityContentQueryDto) {
    const now = new Date();
    const where = this.buildWeappWhere(dto);

    const [list, total] = await Promise.all([
      this.prisma.activityContent.findMany({
        where: {
          ...where,
          status: 1,
          deletedAt: null,
          OR: [
            { startsAt: null, endsAt: null },
            { startsAt: { lte: now }, endsAt: null },
            { startsAt: null, endsAt: { gte: now } },
            { startsAt: { lte: now }, endsAt: { gte: now } },
          ],
        },
        skip: dto.skip,
        take: dto.take,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          title: true,
          subtitle: true,
          type: true,
          coverImage: true,
          summary: true,
          videoUrl: true,
          linkedProductId: true,
          sortOrder: true,
          viewCount: true,
          startsAt: true,
          endsAt: true,
          createdAt: true,
        },
      }),
      this.prisma.activityContent.count({ where }),
    ]);

    return paginate(list.map((item) => this.serialize(item)), total, dto.page, dto.pageSize);
  }

  async findWeappDetail(id: string) {
    const item = await this.prisma.activityContent.findFirst({
      where: { id: BigInt(id), status: 1, deletedAt: null },
    });
    if (!item) throw new NotFoundException('活动内容不存在');

    // 浏览数 +1
    await this.prisma.activityContent
      .update({
        where: { id: BigInt(id) },
        data: { viewCount: { increment: 1 } },
      })
      .catch((err) => this.logger.error(`浏览数自增失败：${id}`, err));

    return this.serialize({ ...item, viewCount: item.viewCount + 1 });
  }

  // ============ 私有工具 ============

  /**
   * 业务规则校验：视频类型必填 videoUrl；商品推荐类型必填 linkedProductId。
   * update 时若未传该字段，则使用 existing 中的值。
   */
  private validateBusinessRules(dto: { type?: string; videoUrl?: string; linkedProductId?: string }, existing?: any) {
    const type = dto.type ?? existing?.type;
    if (type === 'video') {
      const videoUrl = dto.videoUrl !== undefined ? dto.videoUrl : existing?.videoUrl;
      if (!videoUrl || !videoUrl.trim()) {
        throw new BadRequestException('视频类型必须填写视频地址');
      }
    }
    if (type === 'product') {
      const linked = dto.linkedProductId !== undefined ? dto.linkedProductId : existing?.linkedProductId;
      const text = linked ? String(linked).trim() : '';
      if (!text) {
        throw new BadRequestException('商品推荐类型必须关联商品 ID');
      }
    }
  }

  private buildAdminWhere(dto: ActivityContentQueryDto) {
    const where: any = { deletedAt: null };

    const keyword = dto.keyword?.trim();
    if (keyword) {
      where.OR = [
        { title: { contains: keyword } },
        { subtitle: { contains: keyword } },
        { summary: { contains: keyword } },
      ];
    }

    if (dto.type) where.type = dto.type;
    if (dto.status !== undefined) where.status = dto.status;

    return where;
  }

  private buildWeappWhere(dto: ActivityContentQueryDto) {
    const where: any = {};

    const keyword = dto.keyword?.trim();
    if (keyword) {
      where.OR = [
        { title: { contains: keyword } },
        { subtitle: { contains: keyword } },
        { summary: { contains: keyword } },
      ];
    }

    if (dto.type) where.type = dto.type;

    return where;
  }

  private buildCreateData(dto: CreateActivityContentDto): any {
    const data: any = {
      title: dto.title.trim(),
      type: dto.type,
      status: dto.status ?? 0,
      sortOrder: dto.sortOrder ?? 0,
    };

    if (dto.subtitle !== undefined) data.subtitle = this.cleanText(dto.subtitle);
    if (dto.coverImage !== undefined) data.coverImage = this.cleanText(dto.coverImage);
    if (dto.summary !== undefined) data.summary = this.cleanText(dto.summary);
    if (dto.content !== undefined) data.content = dto.content;
    if (dto.videoUrl !== undefined) data.videoUrl = this.cleanText(dto.videoUrl);

    const linkedProductId = this.cleanLinkedProductId(dto.linkedProductId);
    if (linkedProductId !== undefined) data.linkedProductId = linkedProductId;

    const startsAt = this.parseDate(dto.startsAt);
    if (startsAt) data.startsAt = startsAt;
    const endsAt = this.parseDate(dto.endsAt);
    if (endsAt) data.endsAt = endsAt;

    return data;
  }

  private buildUpdateData(dto: UpdateActivityContentDto, existing: any): any {
    const data: any = {};

    if (dto.title !== undefined) {
      const title = dto.title.trim();
      if (!title) throw new BadRequestException('标题不能为空');
      data.title = title;
    }

    if (dto.subtitle !== undefined) data.subtitle = this.cleanText(dto.subtitle);
    if (dto.coverImage !== undefined) data.coverImage = this.cleanText(dto.coverImage);
    if (dto.summary !== undefined) data.summary = this.cleanText(dto.summary);
    if (dto.content !== undefined) data.content = dto.content;
    if (dto.videoUrl !== undefined) data.videoUrl = this.cleanText(dto.videoUrl);

    if (dto.type !== undefined) {
      data.type = dto.type;
    }

    if (dto.linkedProductId !== undefined) {
      data.linkedProductId = this.cleanLinkedProductId(dto.linkedProductId);
    }

    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.status !== undefined) data.status = dto.status;

    if (dto.startsAt !== undefined) {
      const startsAt = this.parseDate(dto.startsAt);
      data.startsAt = startsAt;
    }
    if (dto.endsAt !== undefined) {
      const endsAt = this.parseDate(dto.endsAt);
      data.endsAt = endsAt;
    }

    return data;
  }

  private cleanText(value?: string | null): string | null {
    const text = value?.trim();
    return text || null;
  }

  /**
   * 空字符串、纯空白、非数字字符串都清洗为 null
   */
  private cleanLinkedProductId(value?: string | null): bigint | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const text = String(value).trim();
    if (!text) return null;
    if (!/^\d+$/.test(text)) {
      throw new BadRequestException('关联商品 ID 必须为数字');
    }
    return BigInt(text);
  }

  private parseDate(value?: string | null): Date | null {
    if (!value) return null;
    const text = String(value).trim();
    if (!text) return null;
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`时间格式不正确：${value}`);
    }
    return date;
  }

  private serialize(item: any) {
    return {
      ...item,
      id: item.id.toString(),
      linkedProductId: item.linkedProductId !== null && item.linkedProductId !== undefined
        ? item.linkedProductId.toString()
        : null,
    };
  }
}
