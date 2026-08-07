import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { ActivityService } from './activity.service';
import { ActivityQueryDto } from './dto/activity-query.dto';
import { ActivityProductDto, CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { paginate } from '@baby-mall/shared';

@Injectable()
export class ProductionActivityService extends ActivityService {
  constructor(private readonly productionPrisma: PrismaService) {
    super(productionPrisma);
  }

  override async findActive() {
    const now = new Date();
    const rows = await this.productionPrisma.activity.findMany({
      where: { status: 1, startTime: { lte: now }, endTime: { gte: now } },
      orderBy: { sortOrder: 'asc' },
      select: { id: true },
    });
    return Promise.all(rows.map((row) => super.findById(row.id.toString())));
  }

  override async findByType(type: string) {
    const now = new Date();
    const rows = await this.productionPrisma.activity.findMany({
      where: { type, status: 1, startTime: { lte: now }, endTime: { gte: now } },
      orderBy: { sortOrder: 'asc' },
      select: { id: true },
    });
    return Promise.all(rows.map((row) => super.findById(row.id.toString())));
  }

  async findPublishedById(id: string) {
    const activityId = parsePositiveBigIntId(id, '活动');
    const now = new Date();
    const exists = await this.productionPrisma.activity.findFirst({
      where: {
        id: activityId,
        status: 1,
        startTime: { lte: now },
        endTime: { gte: now },
      },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('活动不存在或未在进行中');
    return super.findById(id);
  }

  override async findById(id: string) {
    parsePositiveBigIntId(id, '活动');
    return super.findById(id);
  }

  override async findAllAdmin(dto: ActivityQueryDto) {
    const where: Prisma.ActivityWhereInput = { status: { not: 4 } };
    if (dto.type) where.type = dto.type;
    if (dto.name) where.name = { contains: dto.name };

    const rows = await this.productionPrisma.activity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { activityProducts: true },
    });
    const now = Date.now();
    const normalized = rows.map((row) => {
      const displayStatus = this.displayStatus(row.status, row.startTime, row.endTime, now);
      return { row, displayStatus };
    });
    const filtered = dto.status === undefined
      ? normalized
      : normalized.filter((item) => item.displayStatus === dto.status);
    const start = dto.skip;
    const pageRows = filtered.slice(start, start + dto.take);
    const serialized = await Promise.all(pageRows.map(async ({ row, displayStatus }) => ({
      ...(await super.findById(row.id.toString())),
      rawStatus: row.status,
      status: displayStatus,
    })));
    return paginate(serialized, filtered.length, dto.page, dto.pageSize);
  }

  override async create(data: CreateActivityDto) {
    const startTime = new Date(data.startTime);
    const endTime = new Date(data.endTime);
    this.assertWindow(startTime, endTime);

    const created = await this.productionPrisma.$transaction(async (tx) => {
      const normalizedProducts = await this.validateProducts(tx, data.products ?? []);
      const activity = await tx.activity.create({
        data: {
          name: data.name.trim(),
          type: data.type,
          description: data.description?.trim() || null,
          rules: data.rules ?? Prisma.JsonNull,
          bannerImage: data.bannerImage?.trim() || null,
          startTime,
          endTime,
          status: 1,
          sortOrder: 0,
        },
      });
      if (normalizedProducts.length > 0) {
        await tx.activityProduct.createMany({
          data: normalizedProducts.map((product) => ({
            activityId: activity.id,
            ...product,
          })),
        });
      }
      return activity;
    });
    return super.findById(created.id.toString());
  }

  override async update(id: string, data: UpdateActivityDto) {
    const activityId = parsePositiveBigIntId(id, '活动');
    const updated = await this.productionPrisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM activities WHERE id = ${activityId} FOR UPDATE`;
      const current = await tx.activity.findUnique({ where: { id: activityId } });
      if (!current || current.status === 4) throw new NotFoundException('活动不存在');

      const startTime = data.startTime ? new Date(data.startTime) : current.startTime;
      const endTime = data.endTime ? new Date(data.endTime) : current.endTime;
      this.assertWindow(startTime, endTime);

      if (data.products !== undefined) {
        const normalizedProducts = await this.validateProducts(tx, data.products);
        await tx.activityProduct.deleteMany({ where: { activityId } });
        if (normalizedProducts.length > 0) {
          await tx.activityProduct.createMany({
            data: normalizedProducts.map((product) => ({ activityId, ...product })),
          });
        }
      }

      return tx.activity.update({
        where: { id: activityId },
        data: {
          ...(data.name !== undefined ? { name: data.name.trim() } : {}),
          ...(data.type !== undefined ? { type: data.type } : {}),
          ...(data.description !== undefined ? { description: data.description.trim() || null } : {}),
          ...(data.rules !== undefined ? { rules: data.rules } : {}),
          ...(data.bannerImage !== undefined ? { bannerImage: data.bannerImage.trim() || null } : {}),
          ...(data.startTime !== undefined ? { startTime } : {}),
          ...(data.endTime !== undefined ? { endTime } : {}),
        },
      });
    });
    return super.findById(updated.id.toString());
  }

  override async updateStatus(id: string, status: number) {
    const activityId = parsePositiveBigIntId(id, '活动');
    if (![0, 1, 2].includes(status)) throw new BadRequestException('活动状态无效');
    const current = await this.productionPrisma.activity.findUnique({ where: { id: activityId } });
    if (!current || current.status === 4) throw new NotFoundException('活动不存在');
    const updated = await this.productionPrisma.activity.update({
      where: { id: activityId },
      data: { status },
    });
    return { ...(await super.findById(id)), rawStatus: updated.status };
  }

  override async delete(id: string) {
    const activityId = parsePositiveBigIntId(id, '活动');
    const updated = await this.productionPrisma.activity.updateMany({
      where: { id: activityId, status: { not: 4 } },
      data: { status: 4 },
    });
    if (updated.count === 0) throw new NotFoundException('活动不存在');
    return { success: true, id: activityId.toString() };
  }

  override async addProduct(activityId: string, data: ActivityProductDto) {
    const activityIdValue = parsePositiveBigIntId(activityId, '活动');
    const result = await this.productionPrisma.$transaction(async (tx) => {
      const activity = await tx.activity.findUnique({ where: { id: activityIdValue } });
      if (!activity || activity.status === 4) throw new NotFoundException('活动不存在');
      const [normalized] = await this.validateProducts(tx, [data]);
      const duplicate = await tx.activityProduct.findFirst({
        where: {
          activityId: activityIdValue,
          productId: normalized.productId,
          skuId: normalized.skuId,
        },
      });
      if (duplicate) throw new BadRequestException('该商品/SKU已加入活动');
      return tx.activityProduct.create({
        data: { activityId: activityIdValue, ...normalized },
      });
    });
    return {
      ...result,
      id: result.id.toString(),
      activityId: result.activityId.toString(),
      productId: result.productId.toString(),
      skuId: result.skuId?.toString() ?? null,
    };
  }

  override async removeProduct(id: string) {
    const relationId = parsePositiveBigIntId(id, '活动商品');
    const result = await this.productionPrisma.activityProduct.deleteMany({ where: { id: relationId } });
    if (result.count === 0) throw new NotFoundException('活动商品不存在');
    return { success: true };
  }

  private async validateProducts(tx: any, products: ActivityProductDto[]) {
    const seen = new Set<string>();
    const result: Array<{
      productId: bigint;
      skuId: bigint | null;
      activityPrice: number;
      activityStock: number;
      limitPerUser: number;
      sortOrder: number;
    }> = [];

    for (const item of products) {
      const productId = parsePositiveBigIntId(item.productId, '商品');
      const skuId = item.skuId ? parsePositiveBigIntId(item.skuId, 'SKU') : null;
      const key = `${productId}:${skuId?.toString() ?? 'all'}`;
      if (seen.has(key)) throw new BadRequestException('活动商品不能重复');
      seen.add(key);

      const product = await tx.product.findFirst({
        where: { id: productId, deletedAt: null, status: 1 },
      });
      if (!product) throw new BadRequestException(`商品${productId}不存在或已下架`);

      let sku: any = null;
      if (skuId) {
        sku = await tx.productSku.findFirst({
          where: { id: skuId, productId, status: 1 },
        });
        if (!sku) throw new BadRequestException(`SKU${skuId}不存在、已下架或不属于该商品`);
      }

      const activityPrice = item.activityPrice ?? (sku?.price ?? product.minPrice ?? 0);
      const activityStock = item.activityStock ?? (sku?.stock ?? 0);
      if (activityPrice < 0) throw new BadRequestException('活动价不能为负数');
      if (sku && activityPrice > sku.price) throw new BadRequestException('活动价不能高于SKU当前售价');
      if (activityStock < 0) throw new BadRequestException('活动库存不能为负数');
      if (sku && activityStock > sku.stock) throw new BadRequestException('活动库存不能超过SKU当前可售库存');

      result.push({
        productId,
        skuId,
        activityPrice,
        activityStock,
        limitPerUser: item.limitPerUser ?? 0,
        sortOrder: 0,
      });
    }
    return result;
  }

  private assertWindow(startTime: Date, endTime: Date) {
    if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime()) || startTime >= endTime) {
      throw new BadRequestException('活动结束时间必须晚于开始时间');
    }
  }

  private displayStatus(rawStatus: number, startTime: Date, endTime: Date, now: number) {
    if (rawStatus === 2) return 2;
    if (rawStatus !== 1) return 0;
    if (endTime.getTime() < now) return 2;
    if (startTime.getTime() > now) return 0;
    return 1;
  }
}
