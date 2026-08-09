import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { paginate } from '@baby-mall/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { getAssetBaseUrl, normalizeAssetUrl } from '../common/utils/asset-url';
import { RecommendationCandidateQueryDto, RecommendationQueryDto } from './dto/recommendation-query.dto';
import { SaveRecommendationItemDto } from './dto/save-recommendation-items.dto';
import { SaveRecommendationDto } from './dto/save-recommendation.dto';

const RECOMMENDATION_SECTION_TYPE = 'recommendation';
const RECOMMENDATION_TYPES = new Set([1, 2, 3]);

interface StoredRecommendationItem {
  targetId: string;
  targetName: string;
  sort: number;
}

@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name);
  private readonly assetBaseUrl = getAssetBaseUrl();

  constructor(private prisma: PrismaService) {}

  async findAll(dto: RecommendationQueryDto) {
    const where = { type: RECOMMENDATION_SECTION_TYPE };

    const [list, total] = await Promise.all([
      this.prisma.homeSection.findMany({
        where,
        skip: dto.skip,
        take: dto.take,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      }),
      this.prisma.homeSection.count({ where }),
    ]);

    return paginate(list.map((section) => this.serialize(section)), total, dto.page, dto.pageSize);
  }

  async create(dto: SaveRecommendationDto) {
    const code = dto.code.trim();
    await this.assertCodeAvailable(code);

    const section = await this.prisma.homeSection.create({
      data: {
        type: RECOMMENDATION_SECTION_TYPE,
        title: dto.name.trim(),
        sortOrder: dto.sort ?? 0,
        status: dto.status ?? 1,
        config: {
          code,
          recommendationType: dto.type,
          items: [],
        },
      },
    });

    this.logger.log(`创建推荐位：${code}`);
    return this.serialize(section);
  }

  async update(id: string, dto: SaveRecommendationDto) {
    const current = await this.findSection(id);
    const currentConfig = this.getConfig(current.config);
    const previousType = this.getRecommendationType(currentConfig);
    const nextCode = String(currentConfig.code || dto.code).trim();

    const section = await this.prisma.homeSection.update({
      where: { id: current.id },
      data: {
        title: dto.name.trim(),
        sortOrder: dto.sort ?? 0,
        status: dto.status ?? 1,
        config: {
          ...currentConfig,
          code: nextCode,
          recommendationType: dto.type,
          items: previousType === dto.type ? this.getStoredItems(currentConfig) : [],
        },
      },
    });

    this.logger.log(`更新推荐位：${id}`);
    return this.serialize(section);
  }

  async delete(id: string) {
    const current = await this.findSection(id);
    const section = await this.prisma.homeSection.delete({ where: { id: current.id } });
    this.logger.log(`删除推荐位：${id}`);
    return { id: section.id.toString() };
  }

  async findItems(id: string) {
    const section = await this.findSection(id);
    return this.getStoredItems(this.getConfig(section.config));
  }

  async findCandidates(id: string, dto: RecommendationCandidateQueryDto) {
    const section = await this.findSection(id);
    const recommendationType = this.getRecommendationType(this.getConfig(section.config));
    const keyword = dto.keyword?.trim() || undefined;

    if (recommendationType === 1) {
      const where: any = { deletedAt: null, status: 1 };
      if (keyword) where.name = { contains: keyword };
      const [rows, total] = await Promise.all([
        this.prisma.product.findMany({
          where,
          skip: dto.skip,
          take: dto.take,
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
          select: { id: true, name: true, mainImage: true, minPrice: true, totalSales: true },
        }),
        this.prisma.product.count({ where }),
      ]);
      return paginate(rows.map((row) => ({
        targetId: row.id.toString(),
        targetName: row.name,
        image: normalizeAssetUrl(row.mainImage, this.assetBaseUrl),
        price: Number(row.minPrice || 0),
        sales: Number(row.totalSales || 0),
      })), total, dto.page, dto.pageSize);
    }

    if (recommendationType === 2) {
      const now = new Date();
      const where: any = { status: 2, endTime: { gte: now } };
      if (keyword) where.name = { contains: keyword };
      const [rows, total] = await Promise.all([
        this.prisma.activity.findMany({
          where,
          skip: dto.skip,
          take: dto.take,
          orderBy: [{ sortOrder: 'asc' }, { startTime: 'asc' }],
          select: { id: true, name: true, type: true, bannerImage: true, startTime: true, endTime: true },
        }),
        this.prisma.activity.count({ where }),
      ]);
      return paginate(rows.map((row) => ({
        targetId: row.id.toString(),
        targetName: row.name,
        image: normalizeAssetUrl(row.bannerImage, this.assetBaseUrl),
        activityType: row.type,
        startTime: row.startTime,
        endTime: row.endTime,
      })), total, dto.page, dto.pageSize);
    }

    const where: any = { deletedAt: null, status: 1 };
    if (keyword) where.title = { contains: keyword };
    const [rows, total] = await Promise.all([
      this.prisma.content.findMany({
        where,
        skip: dto.skip,
        take: dto.take,
        orderBy: [{ isFeatured: 'desc' }, { publishedAt: 'desc' }],
        select: { id: true, title: true, coverImage: true, summary: true, contentType: true, publishedAt: true },
      }),
      this.prisma.content.count({ where }),
    ]);
    return paginate(rows.map((row) => ({
      targetId: row.id.toString(),
      targetName: row.title,
      image: normalizeAssetUrl(row.coverImage, this.assetBaseUrl),
      summary: row.summary || '',
      contentType: row.contentType,
      publishedAt: row.publishedAt,
    })), total, dto.page, dto.pageSize);
  }

  async saveItems(id: string, items: SaveRecommendationItemDto[]) {
    const section = await this.findSection(id);
    const config = this.getConfig(section.config);
    const recommendationType = this.getRecommendationType(config);
    const normalized = await this.resolveItems(recommendationType, items);

    await this.prisma.homeSection.update({
      where: { id: section.id },
      data: {
        config: {
          ...config,
          items: normalized,
        },
      },
    });

    this.logger.log(`更新推荐位项目：${id}，共${normalized.length}项`);
    return normalized;
  }

  private async resolveItems(type: number, items: SaveRecommendationItemDto[]): Promise<StoredRecommendationItem[]> {
    const parsed = items.map((item) => ({
      targetId: parsePositiveBigIntId(item.targetId, '推荐目标'),
      sort: item.sort,
    }));
    const ids = parsed.map((item) => item.targetId);
    const uniqueIds = new Set(ids.map((id) => id.toString()));
    if (uniqueIds.size !== ids.length) throw new BadRequestException('推荐目标不能重复');
    if (ids.length === 0) return [];

    let targets: Array<{ id: bigint; name: string }> = [];
    if (type === 1) {
      const rows = await this.prisma.product.findMany({
        where: { id: { in: ids }, deletedAt: null, status: 1 },
        select: { id: true, name: true },
      });
      targets = rows.map((row) => ({ id: row.id, name: row.name }));
    } else if (type === 2) {
      const rows = await this.prisma.activity.findMany({
        where: { id: { in: ids }, status: 2, endTime: { gte: new Date() } },
        select: { id: true, name: true },
      });
      targets = rows.map((row) => ({ id: row.id, name: row.name }));
    } else if (type === 3) {
      const rows = await this.prisma.content.findMany({
        where: { id: { in: ids }, deletedAt: null, status: 1 },
        select: { id: true, title: true },
      });
      targets = rows.map((row) => ({ id: row.id, name: row.title }));
    }

    if (targets.length !== ids.length) {
      throw new BadRequestException('推荐目标不存在、已下线或已失效，请刷新候选列表后重试');
    }
    const targetMap = new Map(targets.map((target) => [target.id.toString(), target.name]));
    return parsed
      .map((item) => ({
        targetId: item.targetId.toString(),
        targetName: targetMap.get(item.targetId.toString()) || '',
        sort: item.sort,
      }))
      .sort((a, b) => a.sort - b.sort || a.targetId.localeCompare(b.targetId));
  }

  private async assertCodeAvailable(code: string) {
    const sections = await this.prisma.homeSection.findMany({
      where: { type: RECOMMENDATION_SECTION_TYPE },
      select: { config: true },
    });
    if (sections.some((section) => String(this.getConfig(section.config).code || '') === code)) {
      throw new BadRequestException('推荐位编码已存在');
    }
  }

  private async findSection(id: string) {
    const sectionId = parsePositiveBigIntId(id, '推荐位');
    const section = await this.prisma.homeSection.findFirst({
      where: { id: sectionId, type: RECOMMENDATION_SECTION_TYPE },
    });
    if (!section) throw new NotFoundException('推荐位不存在');
    return section;
  }

  private serialize(section: any) {
    const config = this.getConfig(section.config);
    return {
      id: section.id.toString(),
      name: section.title || '',
      code: String(config.code || ''),
      type: this.getRecommendationType(config),
      sort: section.sortOrder,
      status: section.status,
      items: this.getStoredItems(config),
      createdAt: section.createdAt,
      updatedAt: section.updatedAt,
    };
  }

  private getRecommendationType(config: Record<string, any>): number {
    const type = Number(config.recommendationType || 1);
    if (!RECOMMENDATION_TYPES.has(type)) throw new BadRequestException('推荐位类型无效');
    return type;
  }

  private getStoredItems(config: Record<string, any>): StoredRecommendationItem[] {
    if (!Array.isArray(config.items)) return [];
    return config.items
      .map((item: any) => ({
        targetId: String(item?.targetId || '').trim(),
        targetName: String(item?.targetName || '').trim(),
        sort: Number.isSafeInteger(Number(item?.sort)) ? Number(item.sort) : 0,
      }))
      .filter((item) => /^[1-9]\d*$/.test(item.targetId))
      .sort((a, b) => a.sort - b.sort || a.targetId.localeCompare(b.targetId));
  }

  private getConfig(config: any): Record<string, any> {
    return config && typeof config === 'object' && !Array.isArray(config) ? config : {};
  }
}
