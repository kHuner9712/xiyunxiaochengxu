import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ActivityQueryDto } from './dto/activity-query.dto';
import { paginate } from '@baby-mall/shared';

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(private prisma: PrismaService) {}

  async findActive() {
    const now = new Date();
    const list = await this.prisma.activity.findMany({
      where: {
        status: 2,
        startTime: { lte: now },
        endTime: { gte: now },
      },
      orderBy: { sortOrder: 'asc' },
      include: { activityProducts: { include: { product: true } } },
    });
    return list.map((a) => this.serializeActivity(a));
  }

  async findByType(type: string) {
    const now = new Date();
    const list = await this.prisma.activity.findMany({
      where: {
        type,
        status: 2,
        startTime: { lte: now },
        endTime: { gte: now },
      },
      orderBy: { sortOrder: 'asc' },
      include: { activityProducts: { include: { product: true, sku: true } } },
    });
    return list.map((a) => this.serializeActivity(a));
  }

  async findById(id: string) {
    const activity = await this.prisma.activity.findFirst({
      where: { id: BigInt(id) },
      include: { activityProducts: { include: { product: true, sku: true } } },
    });
    if (!activity) throw new NotFoundException('活动不存在');
    return this.serializeActivity(activity);
  }

  async findAllAdmin(dto: ActivityQueryDto) {
    const where: any = {};
    if (dto.type) where.type = dto.type;
    if (dto.status !== undefined) where.status = dto.status;
    if (dto.name) where.name = { contains: dto.name };

    const [list, total] = await Promise.all([
      this.prisma.activity.findMany({
        where,
        skip: dto.skip,
        take: dto.take,
        orderBy: { createdAt: 'desc' },
        include: { activityProducts: true },
      }),
      this.prisma.activity.count({ where }),
    ]);

    return paginate(list.map((a) => this.serializeActivity(a)), total, dto.page, dto.pageSize);
  }

  async create(data: any) {
    const { products, ...activityData } = data;

    const activity = await this.prisma.$transaction(async (tx) => {
      const created = await tx.activity.create({
        data: {
          name: activityData.name,
          type: activityData.type,
          description: activityData.description,
          rules: activityData.rules ? JSON.stringify(activityData.rules) : undefined,
          bannerImage: activityData.bannerImage,
          startTime: new Date(activityData.startTime),
          endTime: new Date(activityData.endTime),
          status: 1,
          sortOrder: 0,
        },
      });

      if (products && products.length > 0) {
        await tx.activityProduct.createMany({
          data: products.map((p: any) => ({
            activityId: created.id,
            productId: BigInt(p.productId),
            skuId: p.skuId ? BigInt(p.skuId) : 0n,
            activityPrice: p.activityPrice ?? 0,
            activityStock: p.activityStock ?? 0,
            limitPerUser: p.limitPerUser ?? 0,
            sortOrder: 0,
          })),
        });
      }

      return created;
    });

    this.logger.log(`创建活动：${activity.id}`);
    return this.serializeActivity(activity);
  }

  async update(id: string, data: any) {
    const activity = await this.prisma.activity.findFirst({ where: { id: BigInt(id) } });
    if (!activity) throw new NotFoundException('活动不存在');

    const updateData: any = { ...data };
    if (data.startTime) updateData.startTime = new Date(data.startTime);
    if (data.endTime) updateData.endTime = new Date(data.endTime);
    if (data.rules) updateData.rules = JSON.stringify(data.rules);

    const result = await this.prisma.activity.update({
      where: { id: BigInt(id) },
      data: updateData,
    });

    this.logger.log(`更新活动：${id}`);
    return this.serializeActivity(result);
  }

  async updateStatus(id: string, status: number) {
    const activity = await this.prisma.activity.findFirst({ where: { id: BigInt(id) } });
    if (!activity) throw new NotFoundException('活动不存在');

    const result = await this.prisma.activity.update({
      where: { id: BigInt(id) },
      data: { status },
    });

    this.logger.log(`更新活动状态：${id} -> ${status}`);
    return this.serializeActivity(result);
  }

  async delete(id: string) {
    const activity = await this.prisma.activity.findFirst({ where: { id: BigInt(id) } });
    if (!activity) throw new NotFoundException('活动不存在');

    const result = await this.prisma.activity.update({
      where: { id: BigInt(id) },
      data: { status: 4 },
    });

    this.logger.log(`删除活动：${id}`);
    return this.serializeActivity(result);
  }

  async addProduct(activityId: string, data: any) {
    const activity = await this.prisma.activity.findFirst({ where: { id: BigInt(activityId) } });
    if (!activity) throw new NotFoundException('活动不存在');

    const result = await this.prisma.activityProduct.create({
      data: {
        activityId: BigInt(activityId),
        productId: BigInt(data.productId),
        skuId: data.skuId ? BigInt(data.skuId) : 0n,
        activityPrice: data.activityPrice ?? 0,
        activityStock: data.activityStock ?? 0,
        limitPerUser: data.limitPerUser ?? 0,
        sortOrder: 0,
      },
    });

    this.logger.log(`添加活动商品：活动${activityId}，商品${data.productId}`);
    return {
      ...result,
      id: result.id.toString(),
      activityId: result.activityId.toString(),
      productId: result.productId.toString(),
      skuId: result.skuId?.toString(),
    };
  }

  async removeProduct(id: string) {
    const product = await this.prisma.activityProduct.findFirst({ where: { id: BigInt(id) } });
    if (!product) throw new NotFoundException('活动商品不存在');

    await this.prisma.activityProduct.delete({ where: { id: BigInt(id) } });
    this.logger.log(`移除活动商品：${id}`);
    return { success: true };
  }

  private serializeActivity(activity: any) {
    return {
      ...activity,
      id: activity.id.toString(),
      activityProducts: activity.activityProducts?.map((ap: any) => ({
        ...ap,
        id: ap.id.toString(),
        activityId: ap.activityId.toString(),
        productId: ap.productId.toString(),
        skuId: ap.skuId?.toString(),
        product: ap.product ? { ...ap.product, id: ap.product.id.toString() } : undefined,
        sku: ap.sku ? { ...ap.sku, id: ap.sku.id.toString() } : undefined,
      })),
    };
  }
}
