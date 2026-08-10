import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { paginate } from '@baby-mall/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import {
  ActivityContentQueryDto,
  CreateActivityContentDto,
  UpdateActivityContentDto,
} from './dto/activity-content.dto';
import { ActivityContentService } from './activity-content.service';

@Injectable()
export class ProductionActivityContentService extends ActivityContentService {
  constructor(private readonly productionPrisma: PrismaService) {
    super(productionPrisma);
  }

  override async findWeappList(dto: ActivityContentQueryDto) {
    const where = this.buildPublicWhere(dto, new Date());
    const [list, total] = await Promise.all([
      this.productionPrisma.activityContent.findMany({
        where,
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
      this.productionPrisma.activityContent.count({ where }),
    ]);

    const rows = await Promise.all(list.map((item) => this.serializePublicItem(item)));
    return paginate(rows, total, dto.page, dto.pageSize);
  }

  override async findWeappDetail(id: string) {
    const contentId = parsePositiveBigIntId(id, '活动内容');
    const item = await this.productionPrisma.activityContent.findFirst({
      where: {
        id: contentId,
        ...this.buildPublicWhere({} as ActivityContentQueryDto, new Date()),
      },
    });
    if (!item) throw new NotFoundException('活动内容不存在或当前不可访问');

    await this.productionPrisma.activityContent
      .update({
        where: { id: contentId },
        data: { viewCount: { increment: 1 } },
      })
      .catch(() => undefined);

    return this.serializePublicItem({ ...item, viewCount: item.viewCount + 1 });
  }

  override async create(dto: CreateActivityContentDto) {
    await this.assertFinalState(dto);
    return super.create(dto);
  }

  override async update(id: string, dto: UpdateActivityContentDto) {
    const contentId = parsePositiveBigIntId(id, '活动内容');
    const existing = await this.productionPrisma.activityContent.findFirst({
      where: { id: contentId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('活动内容不存在');
    await this.assertFinalState(dto, existing);
    return super.update(id, dto);
  }

  override async updateStatus(id: string, status: number) {
    const contentId = parsePositiveBigIntId(id, '活动内容');
    const existing = await this.productionPrisma.activityContent.findFirst({
      where: { id: contentId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('活动内容不存在');
    if (status === 1) {
      await this.assertFinalState({ status } as UpdateActivityContentDto, existing);
    }
    return super.updateStatus(id, status);
  }

  private buildPublicWhere(dto: Pick<ActivityContentQueryDto, 'keyword' | 'type'>, now: Date) {
    const and: any[] = [
      {
        OR: [
          { startsAt: null, endsAt: null },
          { startsAt: { lte: now }, endsAt: null },
          { startsAt: null, endsAt: { gte: now } },
          { startsAt: { lte: now }, endsAt: { gte: now } },
        ],
      },
    ];
    const keyword = dto.keyword?.trim();
    if (keyword) {
      and.push({
        OR: [
          { title: { contains: keyword } },
          { subtitle: { contains: keyword } },
          { summary: { contains: keyword } },
        ],
      });
    }

    return {
      status: 1,
      deletedAt: null,
      ...(dto.type ? { type: dto.type } : {}),
      AND: and,
    };
  }

  private async serializePublicItem(item: any) {
    let linkedProductId: string | null = null;
    if (item.linkedProductId !== null && item.linkedProductId !== undefined) {
      const product = await this.productionPrisma.product.findFirst({
        where: {
          id: item.linkedProductId,
          deletedAt: null,
          status: 1,
        },
        select: { id: true },
      });
      linkedProductId = product ? product.id.toString() : null;
    }
    return {
      ...item,
      id: item.id.toString(),
      linkedProductId,
    };
  }

  private async assertFinalState(
    dto: Partial<CreateActivityContentDto & UpdateActivityContentDto>,
    existing?: any,
  ) {
    const finalType = dto.type ?? existing?.type;
    const finalStatus = dto.status ?? existing?.status ?? 0;
    const startsAt = dto.startsAt !== undefined
      ? this.parseOptionalDate(dto.startsAt, '开始时间')
      : existing?.startsAt ?? null;
    const endsAt = dto.endsAt !== undefined
      ? this.parseOptionalDate(dto.endsAt, '结束时间')
      : existing?.endsAt ?? null;

    if (startsAt && endsAt && startsAt.getTime() >= endsAt.getTime()) {
      throw new BadRequestException('活动内容结束时间必须晚于开始时间');
    }

    const linkedRaw = dto.linkedProductId !== undefined
      ? dto.linkedProductId
      : existing?.linkedProductId?.toString() ?? null;
    const linkedText = linkedRaw === null || linkedRaw === undefined ? '' : String(linkedRaw).trim();
    if (finalType === 'product' && !linkedText) {
      throw new BadRequestException('商品推荐类型必须关联商品 ID');
    }

    if (linkedText) {
      const linkedProductId = parsePositiveBigIntId(linkedText, '关联商品');
      const product = await this.productionPrisma.product.findFirst({
        where: { id: linkedProductId, deletedAt: null, status: 1 },
        select: { id: true },
      });
      if (!product) {
        throw new BadRequestException('关联商品不存在或已下架');
      }
    }

    if (![0, 1].includes(Number(finalStatus))) {
      throw new BadRequestException('活动内容状态无效');
    }
  }

  private parseOptionalDate(value: string | null | undefined, label: string): Date | null {
    if (value === undefined || value === null || String(value).trim() === '') return null;
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) throw new BadRequestException(`${label}格式无效`);
    return date;
  }
}
