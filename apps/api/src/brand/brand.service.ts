import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { paginate } from '@baby-mall/shared';

const BRAND_CREATE_EVENT = 'brand_create';
const SERIALIZABLE_RETRY_LIMIT = 3;

@Injectable()
export class BrandService {
  private readonly logger = new Logger(BrandService.name);

  constructor(private prisma: PrismaService) {}

  async findPublished(dto: PaginationDto) {
    const where = { deletedAt: null, status: 1 };
    const [list, total] = await Promise.all([
      this.prisma.brand.findMany({
        where,
        skip: dto.skip,
        take: dto.take,
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.brand.count({ where }),
    ]);
    this.logger.log(`查询上架品牌列表，共${total}条`);
    return paginate(
      list.map((b) => ({ ...b, id: b.id.toString() })),
      total,
      dto.page,
      dto.pageSize,
    );
  }

  async findAllAdmin(dto: PaginationDto & { keyword?: string }) {
    const where: any = { deletedAt: null };
    if (dto.keyword) where.name = { contains: dto.keyword };
    const [list, total] = await Promise.all([
      this.prisma.brand.findMany({
        where,
        skip: dto.skip,
        take: dto.take,
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.brand.count({ where }),
    ]);
    this.logger.log(`管理员查询品牌列表，共${total}条`);
    return paginate(
      list.map((b) => ({ ...b, id: b.id.toString() })),
      total,
      dto.page,
      dto.pageSize,
    );
  }

  async findById(id: string) {
    const brandId = parsePositiveBigIntId(id, '品牌');
    const brand = await this.prisma.brand.findFirst({
      where: { id: brandId, deletedAt: null },
    });
    if (!brand) throw new NotFoundException('品牌不存在');
    return { ...brand, id: brand.id.toString() };
  }

  async create(dto: CreateBrandDto) {
    const requestId = dto.clientRequestId?.trim() || null;
    const createData = {
      name: dto.name.trim(),
      logo: dto.logo?.trim() || null,
      description: dto.description ?? null,
      sortOrder: dto.sortOrder ?? 0,
    };
    const fingerprint = JSON.stringify(createData);

    for (let attempt = 0; attempt < SERIALIZABLE_RETRY_LIMIT; attempt += 1) {
      try {
        const result = await this.prisma.$transaction(
          async (tx) => {
            if (requestId) {
              const handled = await tx.businessEvent.findFirst({
                where: {
                  eventType: BRAND_CREATE_EVENT,
                  bizType: 'brand',
                  bizId: requestId,
                },
                orderBy: { id: 'desc' },
              });
              if (handled) {
                const eventPayload = this.readCreateEventPayload(handled.payload);
                if (eventPayload.fingerprint !== fingerprint) {
                  throw new BadRequestException('品牌创建请求ID已被其他操作使用，请重新提交');
                }
                const replay = await tx.brand.findFirst({
                  where: { id: parsePositiveBigIntId(eventPayload.brandId, '品牌') },
                });
                if (!replay) {
                  throw new BadRequestException('该品牌创建请求已处理，但品牌记录不存在，请刷新后重试');
                }
                if (replay.deletedAt) {
                  throw new BadRequestException('该品牌创建请求已处理，但品牌已删除，请刷新品牌列表');
                }
                return { brand: replay, replayed: true };
              }
            }

            const existing = await tx.brand.findFirst({
              where: { name: createData.name, deletedAt: null },
            });
            if (existing) throw new BadRequestException('品牌名称已存在');

            const brand = await tx.brand.create({ data: createData });
            if (requestId) {
              await tx.businessEvent.create({
                data: {
                  eventType: BRAND_CREATE_EVENT,
                  bizType: 'brand',
                  bizId: requestId,
                  level: 'info',
                  message: '品牌创建请求已处理',
                  payload: {
                    brandId: brand.id.toString(),
                    fingerprint,
                  },
                },
              });
            }
            return { brand, replayed: false };
          },
          { isolationLevel: 'Serializable' },
        );

        this.logger.log(`创建品牌：${result.brand.id} - ${createData.name}${result.replayed ? '（幂等重放）' : ''}`);
        return { ...result.brand, id: result.brand.id.toString() };
      } catch (error: any) {
        if (error?.code === 'P2034' && attempt + 1 < SERIALIZABLE_RETRY_LIMIT) continue;
        throw error;
      }
    }

    throw new Error('品牌创建事务重试次数已耗尽');
  }

  async update(id: string, dto: UpdateBrandDto) {
    const brandId = parsePositiveBigIntId(id, '品牌');

    for (let attempt = 0; attempt < SERIALIZABLE_RETRY_LIMIT; attempt += 1) {
      try {
        const result = await this.prisma.$transaction(
          async (tx) => {
            const locked = await tx.$queryRaw<Array<{ id: bigint }>>`
              SELECT id FROM brands WHERE id = ${brandId} AND deleted_at IS NULL FOR UPDATE
            `;
            if (locked.length === 0) throw new NotFoundException('品牌不存在');

            const brand = await tx.brand.findFirst({
              where: { id: brandId, deletedAt: null },
            });
            if (!brand) throw new NotFoundException('品牌不存在');

            const nextName = dto.name !== undefined ? dto.name.trim() : brand.name;
            if (nextName !== brand.name) {
              const existing = await tx.brand.findFirst({
                where: { name: nextName, deletedAt: null, id: { not: brandId } },
              });
              if (existing) throw new BadRequestException('品牌名称已存在');
            }

            const updateData: any = {};
            if (dto.name !== undefined) updateData.name = nextName;
            if (dto.logo !== undefined) updateData.logo = dto.logo?.trim() || null;
            if (dto.description !== undefined) updateData.description = dto.description;
            if (dto.sortOrder !== undefined) updateData.sortOrder = dto.sortOrder;

            return tx.brand.update({ where: { id: brandId }, data: updateData });
          },
          { isolationLevel: 'Serializable' },
        );

        this.logger.log(`更新品牌：${id}`);
        return { ...result, id: result.id.toString() };
      } catch (error: any) {
        if (error?.code === 'P2034' && attempt + 1 < SERIALIZABLE_RETRY_LIMIT) continue;
        throw error;
      }
    }

    throw new Error('品牌更新事务重试次数已耗尽');
  }

  async delete(id: string) {
    const brandId = parsePositiveBigIntId(id, '品牌');
    const result = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: bigint }>>`
        SELECT id
        FROM brands
        WHERE id = ${brandId}
        FOR UPDATE
      `;
      if (locked.length === 0) throw new NotFoundException('品牌不存在');

      const brand = await tx.brand.findFirst({ where: { id: brandId } });
      if (!brand) throw new NotFoundException('品牌不存在');
      if (brand.deletedAt) return { brand, replayed: true };

      const products = await tx.product.count({
        where: { brandId, deletedAt: null },
      });
      if (products > 0) throw new BadRequestException('品牌下存在商品，无法删除');

      const deleted = await tx.brand.update({
        where: { id: brandId },
        data: { deletedAt: new Date() },
      });
      return { brand: deleted, replayed: false };
    });
    this.logger.log(`删除品牌：${id}${result.replayed ? '（幂等重放）' : ''}`);
    return { ...result.brand, id: result.brand.id.toString() };
  }

  private readCreateEventPayload(payload: unknown): { brandId: string; fingerprint: string } {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new BadRequestException('品牌创建请求记录异常，请刷新品牌列表后重试');
    }
    const record = payload as Record<string, unknown>;
    const brandId = typeof record.brandId === 'string' ? record.brandId : '';
    const fingerprint = typeof record.fingerprint === 'string' ? record.fingerprint : '';
    if (!/^[1-9]\d*$/.test(brandId) || !fingerprint) {
      throw new BadRequestException('品牌创建请求记录异常，请刷新品牌列表后重试');
    }
    return { brandId, fingerprint };
  }
}
