import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { paginate } from '@baby-mall/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { RecommendationQueryDto } from './dto/recommendation-query.dto';
import { SaveRecommendationDto } from './dto/save-recommendation.dto';

const RECOMMENDATION_SECTION_TYPE = 'recommendation';

@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name);

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
    const section = await this.prisma.homeSection.create({
      data: {
        type: RECOMMENDATION_SECTION_TYPE,
        title: dto.name,
        sortOrder: dto.sort ?? 0,
        status: dto.status ?? 1,
        config: {
          code: dto.code,
          recommendationType: dto.type,
          items: [],
        },
      },
    });

    this.logger.log(`创建推荐位：${dto.code}`);
    return this.serialize(section);
  }

  async update(id: string, dto: SaveRecommendationDto) {
    const current = await this.findSection(id);
    const currentConfig = this.getConfig(current.config);

    const section = await this.prisma.homeSection.update({
      where: { id: BigInt(id) },
      data: {
        title: dto.name,
        sortOrder: dto.sort ?? 0,
        status: dto.status ?? 1,
        config: {
          ...currentConfig,
          code: currentConfig.code || dto.code,
          recommendationType: dto.type,
        },
      },
    });

    this.logger.log(`更新推荐位：${id}`);
    return this.serialize(section);
  }

  async delete(id: string) {
    await this.findSection(id);
    const section = await this.prisma.homeSection.delete({
      where: { id: BigInt(id) },
    });
    this.logger.log(`删除推荐位：${id}`);
    return { id: section.id.toString() };
  }

  async findItems(id: string) {
    const section = await this.findSection(id);
    return this.getConfig(section.config).items || [];
  }

  async saveItems(id: string, items: any[]) {
    const section = await this.findSection(id);
    const config = this.getConfig(section.config);

    await this.prisma.homeSection.update({
      where: { id: BigInt(id) },
      data: {
        config: {
          ...config,
          items,
        },
      },
    });

    return items;
  }

  private async findSection(id: string) {
    const section = await this.prisma.homeSection.findFirst({
      where: { id: BigInt(id), type: RECOMMENDATION_SECTION_TYPE },
    });
    if (!section) throw new NotFoundException('推荐位不存在');
    return section;
  }

  private serialize(section: any) {
    const config = this.getConfig(section.config);
    return {
      id: section.id.toString(),
      name: section.title || '',
      code: config.code || '',
      type: Number(config.recommendationType || 1),
      sort: section.sortOrder,
      status: section.status,
      items: config.items || [],
      createdAt: section.createdAt,
      updatedAt: section.updatedAt,
    };
  }

  private getConfig(config: any): Record<string, any> {
    return config && typeof config === 'object' && !Array.isArray(config) ? config : {};
  }
}
