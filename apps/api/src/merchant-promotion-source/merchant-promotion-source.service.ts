import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { paginate } from '@baby-mall/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  CreateMerchantPromotionSourceDto,
  MerchantPromotionSourceQueryDto,
  UpdateMerchantPromotionSourceDto,
} from './dto/merchant-promotion-source.dto';

@Injectable()
export class MerchantPromotionSourceService {
  private readonly logger = new Logger(MerchantPromotionSourceService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(dto: MerchantPromotionSourceQueryDto) {
    const where = this.buildWhere(dto);

    const [list, total] = await Promise.all([
      this.prisma.merchantPromotionSource.findMany({
        where,
        skip: dto.skip,
        take: dto.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.merchantPromotionSource.count({ where }),
    ]);

    this.logger.log(`管理员查询商家推广码列表，共${total}条`);
    return paginate(list.map((item) => this.serialize(item)), total, dto.page, dto.pageSize);
  }

  async findStats(dto: MerchantPromotionSourceQueryDto) {
    const where = this.buildWhere(dto);
    const sources = await this.prisma.merchantPromotionSource.findMany({
      where,
      take: 200,
      orderBy: { createdAt: 'desc' },
    });

    const codes = sources
      .map((source) => source.promotionCode)
      .filter((code): code is string => Boolean(code));

    if (codes.length === 0) {
      return [];
    }

    const orderGroups = await this.prisma.order.groupBy({
      by: ['sourceCode', 'status'],
      where: {
        sourceType: 'merchant_referral',
        sourceCode: { in: codes },
      },
      _count: { _all: true },
      _sum: { payAmount: true },
      _min: { createdAt: true },
      _max: { createdAt: true },
    });

    const statusKeyMap: Record<string, string> = {
      pending_payment: 'pendingPaymentCount',
      paid: 'paidCount',
      pending_delivery: 'pendingDeliveryCount',
      pending_pickup: 'pendingPickupCount',
      delivered: 'deliveredCount',
      completed: 'completedCount',
      cancelled: 'cancelledCount',
      aftersale: 'aftersaleCount',
    };
    const effectivePaidStatuses = new Set([
      'paid',
      'pending_delivery',
      'pending_pickup',
      'delivered',
      'completed',
      'aftersale',
    ]);

    const statsByCode = new Map<string, any>();

    for (const source of sources) {
      statsByCode.set(source.promotionCode, {
        id: source.id.toString(),
        name: source.name,
        promotionCode: source.promotionCode,
        contactName: source.contactName,
        contactPhone: source.contactPhone,
        scene: source.scene,
        status: source.status,
        orderCount: 0,
        totalPayAmount: 0,
        effectivePayAmount: 0,
        pendingPaymentCount: 0,
        paidCount: 0,
        pendingDeliveryCount: 0,
        pendingPickupCount: 0,
        deliveredCount: 0,
        completedCount: 0,
        cancelledCount: 0,
        aftersaleCount: 0,
        firstOrderTime: null,
        lastOrderTime: null,
      });
    }

    for (const group of orderGroups) {
      const code = group.sourceCode || '';
      const row = statsByCode.get(code);
      if (!row) continue;

      const count = group._count?._all || 0;
      const payAmount = group._sum?.payAmount || 0;
      const status = String(group.status);
      const statusKey = statusKeyMap[status];

      row.orderCount += count;
      row.totalPayAmount += payAmount;
      if (effectivePaidStatuses.has(status)) {
        row.effectivePayAmount += payAmount;
      }
      if (statusKey) {
        row[statusKey] += count;
      }

      const minTime = group._min?.createdAt;
      const maxTime = group._max?.createdAt;
      if (minTime && (!row.firstOrderTime || minTime < row.firstOrderTime)) {
        row.firstOrderTime = minTime;
      }
      if (maxTime && (!row.lastOrderTime || maxTime > row.lastOrderTime)) {
        row.lastOrderTime = maxTime;
      }
    }

    const result = Array.from(statsByCode.values()).sort((a, b) => {
      if (b.orderCount !== a.orderCount) return b.orderCount - a.orderCount;
      return b.effectivePayAmount - a.effectivePayAmount;
    });

    this.logger.log(`管理员查询商家推广效果统计，共${result.length}条`);
    return result;
  }

  async findOrdersByPromotionCode(promotionCode: string, dto: MerchantPromotionSourceQueryDto) {
    const code = promotionCode.trim().toUpperCase();
    if (!code) throw new BadRequestException('推广码不能为空');

    const where = {
      sourceType: 'merchant_referral',
      sourceCode: code,
    };

    const [list, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip: dto.skip,
        take: dto.take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, nickname: true, phone: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    this.logger.log(`管理员查询商家推广订单明细：${code}，共${total}条`);

    return paginate(
      list.map((order) => ({
        id: order.id.toString(),
        orderNo: order.orderNo,
        status: order.status,
        payAmount: order.payAmount || 0,
        totalAmount: order.totalAmount || 0,
        userId: order.userId?.toString(),
        userName: order.user?.nickname || '',
        userPhone: order.user?.phone || '',
        sourceType: order.sourceType,
        sourceCode: order.sourceCode,
        createdAt: order.createdAt,
        paidAt: order.paidAt,
      })),
      total,
      dto.page,
      dto.pageSize,
    );
  }

  async findById(id: string) {
    const source = await this.prisma.merchantPromotionSource.findFirst({
      where: { id: BigInt(id), deletedAt: null },
    });
    if (!source) throw new NotFoundException('商家推广码不存在');
    return this.serialize(source);
  }

  async create(dto: CreateMerchantPromotionSourceDto) {
    const name = dto.name.trim();
    const promotionCode = dto.promotionCode.trim().toUpperCase();

    if (!name) throw new BadRequestException('商家名称不能为空');
    if (!promotionCode) throw new BadRequestException('推广码不能为空');

    const existing = await this.prisma.merchantPromotionSource.findFirst({
      where: { promotionCode, deletedAt: null },
    });
    if (existing) throw new BadRequestException('推广码已存在');

    const result = await this.prisma.merchantPromotionSource.create({
      data: {
        name,
        promotionCode,
        contactName: this.cleanText(dto.contactName),
        contactPhone: this.cleanText(dto.contactPhone),
        scene: this.cleanText(dto.scene),
        remark: this.cleanText(dto.remark),
        status: dto.status ?? 1,
      },
    });

    this.logger.log(`创建商家推广码：${result.id} - ${promotionCode}`);
    return this.serialize(result);
  }

  async update(id: string, dto: UpdateMerchantPromotionSourceDto) {
    const source = await this.prisma.merchantPromotionSource.findFirst({
      where: { id: BigInt(id), deletedAt: null },
    });
    if (!source) throw new NotFoundException('商家推广码不存在');

    const updateData: any = {};

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new BadRequestException('商家名称不能为空');
      updateData.name = name;
    }

    if (dto.promotionCode !== undefined) {
      const promotionCode = dto.promotionCode.trim().toUpperCase();
      if (!promotionCode) throw new BadRequestException('推广码不能为空');

      if (promotionCode !== source.promotionCode) {
        const existing = await this.prisma.merchantPromotionSource.findFirst({
          where: {
            promotionCode,
            deletedAt: null,
            id: { not: BigInt(id) },
          },
        });
        if (existing) throw new BadRequestException('推广码已存在');
      }

      updateData.promotionCode = promotionCode;
    }

    if (dto.contactName !== undefined) updateData.contactName = this.cleanText(dto.contactName);
    if (dto.contactPhone !== undefined) updateData.contactPhone = this.cleanText(dto.contactPhone);
    if (dto.scene !== undefined) updateData.scene = this.cleanText(dto.scene);
    if (dto.remark !== undefined) updateData.remark = this.cleanText(dto.remark);
    if (dto.status !== undefined) updateData.status = dto.status;

    const result = await this.prisma.merchantPromotionSource.update({
      where: { id: BigInt(id) },
      data: updateData,
    });

    this.logger.log(`更新商家推广码：${id}`);
    return this.serialize(result);
  }

  async updateStatus(id: string, status: number) {
    const source = await this.prisma.merchantPromotionSource.findFirst({
      where: { id: BigInt(id), deletedAt: null },
    });
    if (!source) throw new NotFoundException('商家推广码不存在');

    const result = await this.prisma.merchantPromotionSource.update({
      where: { id: BigInt(id) },
      data: { status },
    });

    this.logger.log(`更新商家推广码状态：${id} -> ${status}`);
    return this.serialize(result);
  }

  private buildWhere(dto: MerchantPromotionSourceQueryDto) {
    const where: any = { deletedAt: null };

    const keyword = dto.keyword?.trim();
    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { promotionCode: { contains: keyword.toUpperCase() } },
        { contactName: { contains: keyword } },
        { contactPhone: { contains: keyword } },
        { scene: { contains: keyword } },
      ];
    }

    if (dto.name?.trim()) where.name = { contains: dto.name.trim() };
    if (dto.promotionCode?.trim()) where.promotionCode = { contains: dto.promotionCode.trim().toUpperCase() };
    if (dto.scene?.trim()) where.scene = { contains: dto.scene.trim() };
    if (dto.status !== undefined) where.status = dto.status;

    return where;
  }

  private cleanText(value?: string | null) {
    const text = value?.trim();
    return text || null;
  }

  private serialize(source: any) {
    return {
      ...source,
      id: source.id.toString(),
    };
  }
}
