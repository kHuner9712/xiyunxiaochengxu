import { createHash } from 'crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { ActivityService } from './activity.service';
import { ActivityQueryDto } from './dto/activity-query.dto';
import { ActivityProductDto, CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { paginate } from '@baby-mall/shared';

export const ACTIVITY_CREATE_EVENT = 'activity_create';
const ACTIVITY_PRODUCT_REMOVE_EVENT = 'activity_product_remove';
const SERIALIZABLE_RETRY_LIMIT = 3;

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
    const requestId = data.clientRequestId?.trim() || null;
    const fingerprint = this.createRequestFingerprint(data, startTime, endTime);

    for (let attempt = 0; attempt < SERIALIZABLE_RETRY_LIMIT; attempt += 1) {
      try {
        const result = await this.productionPrisma.$transaction(
          async (tx) => {
            if (requestId) {
              const handled = await tx.businessEvent.findFirst({
                where: {
                  eventType: ACTIVITY_CREATE_EVENT,
                  bizType: 'activity',
                  bizId: requestId,
                },
                orderBy: { id: 'desc' },
              });
              if (handled) {
                const payload = this.readCreateEventPayload(handled.payload);
                if (payload.fingerprint !== fingerprint) {
                  throw new BadRequestException('活动创建请求ID已被其他操作使用，请重新提交');
                }
                const replay = await tx.activity.findUnique({
                  where: { id: parsePositiveBigIntId(payload.activityId, '活动') },
                });
                if (!replay) {
                  throw new BadRequestException('该活动创建请求已处理，但活动记录不存在，请刷新活动列表后重试');
                }
                if (replay.status === 4) {
                  throw new BadRequestException('该活动创建请求已处理，但活动已删除，请刷新活动列表');
                }
                return { activity: replay, replayed: true };
              }
            }

            const normalizedProducts = await this.validateProducts(tx, data.products ?? []);
            const activity = await tx.activity.create({
              data: {
                name: data.name.trim(),
                type: data.type,
                description: data.description?.trim() || null,
                rules: this.toPrismaJson(data.rules),
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
            if (requestId) {
              await tx.businessEvent.create({
                data: {
                  eventType: ACTIVITY_CREATE_EVENT,
                  bizType: 'activity',
                  bizId: requestId,
                  level: 'info',
                  message: '活动创建请求已处理',
                  payload: {
                    activityId: activity.id.toString(),
                    fingerprint,
                  },
                },
              });
            }
            return { activity, replayed: false };
          },
          { isolationLevel: 'Serializable' },
        );
        return super.findById(result.activity.id.toString());
      } catch (error: any) {
        if (error?.code === 'P2034' && attempt + 1 < SERIALIZABLE_RETRY_LIMIT) continue;
        throw error;
      }
    }

    throw new Error('活动创建事务重试次数已耗尽');
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
          ...(data.rules !== undefined ? { rules: this.toPrismaJson(data.rules) } : {}),
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
    const updated = await this.productionPrisma.activity.updateMany({
      where: { id: activityId, status: { not: 4 } },
      data: { status },
    });
    if (updated.count === 0) throw new NotFoundException('活动不存在');
    return { ...(await super.findById(id)), rawStatus: status };
  }

  override async delete(id: string) {
    const activityId = parsePositiveBigIntId(id, '活动');
    const updated = await this.productionPrisma.activity.updateMany({
      where: { id: activityId, status: { not: 4 } },
      data: { status: 4 },
    });
    if (updated.count === 0) {
      const current = await this.productionPrisma.activity.findUnique({
        where: { id: activityId },
        select: { id: true, status: true },
      });
      if (!current) throw new NotFoundException('活动不存在');
      if (current.status !== 4) throw new BadRequestException('活动状态已变更，请刷新活动列表后重试');
    }
    return { success: true, id: activityId.toString() };
  }

  override async addProduct(activityId: string, data: ActivityProductDto) {
    const activityIdValue = parsePositiveBigIntId(activityId, '活动');
    const result = await this.productionPrisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM activities WHERE id = ${activityIdValue} FOR UPDATE`;
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
      skuId: result.skuId?.toString(),
    };
  }

  override async removeProduct(id: string) {
    const relationId = parsePositiveBigIntId(id, '活动商品');
    return this.productionPrisma.$transaction(async (tx) => {
      const handled = await tx.businessEvent.findFirst({
        where: {
          eventType: ACTIVITY_PRODUCT_REMOVE_EVENT,
          bizType: 'activity_product',
          bizId: relationId.toString(),
        },
        orderBy: { id: 'desc' },
      });
      if (handled) return { success: true };

      const relation = await tx.activityProduct.findUnique({ where: { id: relationId } });
      if (!relation) throw new NotFoundException('活动商品不存在');
      await tx.$queryRaw`SELECT id FROM activities WHERE id = ${relation.activityId} FOR UPDATE`;
      await tx.activityProduct.delete({ where: { id: relationId } });
      await tx.businessEvent.create({
        data: {
          eventType: ACTIVITY_PRODUCT_REMOVE_EVENT,
          bizType: 'activity_product',
          bizId: relationId.toString(),
          level: 'info',
          message: '活动商品删除已处理',
          payload: { activityId: relation.activityId.toString() },
        },
      });
      return { success: true };
    });
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

  private createRequestFingerprint(data: CreateActivityDto, startTime: Date, endTime: Date) {
    const products = (data.products ?? [])
      .map((item) => ({
        productId: String(item.productId),
        skuId: item.skuId ? String(item.skuId) : null,
        activityPrice: item.activityPrice ?? null,
        activityStock: item.activityStock ?? null,
        limitPerUser: item.limitPerUser ?? null,
      }))
      .sort((a, b) => `${a.productId}:${a.skuId ?? ''}`.localeCompare(`${b.productId}:${b.skuId ?? ''}`));
    const canonical = this.canonicalize({
      name: data.name.trim(),
      type: data.type,
      description: data.description?.trim() || null,
      rules: data.rules ?? null,
      bannerImage: data.bannerImage?.trim() || null,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      products,
    });
    return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
  }

  private canonicalize(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => this.canonicalize(item));
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, item]) => [key, this.canonicalize(item)]),
      );
    }
    return value;
  }

  private readCreateEventPayload(payload: unknown): { activityId: string; fingerprint: string } {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new BadRequestException('活动创建请求记录异常，请刷新活动列表后重试');
    }
    const record = payload as Record<string, unknown>;
    const activityId = typeof record.activityId === 'string' ? record.activityId : '';
    const fingerprint = typeof record.fingerprint === 'string' ? record.fingerprint : '';
    if (!/^[1-9]\d*$/.test(activityId) || !fingerprint) {
      throw new BadRequestException('活动创建请求记录异常，请刷新活动列表后重试');
    }
    return { activityId, fingerprint };
  }

  private toPrismaJson(value: Record<string, unknown> | undefined) {
    return value === undefined ? Prisma.JsonNull : value as Prisma.InputJsonValue;
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
