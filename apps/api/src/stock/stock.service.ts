import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { paginate } from '@baby-mall/shared';
import { StockQueryDto } from './dto/stock-query.dto';
import { StockAdjustDto } from './dto/stock-adjust.dto';

@Injectable()
export class StockService {
  private readonly logger = new Logger(StockService.name);

  constructor(private prisma: PrismaService) {}

  async findList(dto: StockQueryDto) {
    const where: any = {
      product: { deletedAt: null },
    };

    if (dto.name) {
      where.product.name = { contains: dto.name };
    }

    if (dto.stockStatus === 'zero') {
      where.stock = 0;
    } else if (dto.stockStatus === 'low') {
      where.stock = { gt: 0, lte: 10 };
    }

    const [list, total] = await Promise.all([
      this.prisma.productSku.findMany({
        where,
        skip: dto.skip,
        take: dto.take,
        orderBy: { updatedAt: 'desc' },
        include: {
          product: { select: { id: true, name: true, deletedAt: true } },
        },
      }),
      this.prisma.productSku.count({ where }),
    ]);

    return paginate(
      list.map((sku) => ({
        id: sku.id.toString(),
        productId: sku.productId.toString(),
        skuId: sku.id.toString(),
        name: sku.product?.name || '',
        skuName: this.formatSpecs(sku.specs),
        stock: sku.stock,
        price: sku.price,
      })),
      total,
      dto.page,
      dto.pageSize,
    );
  }

  async findLogs(dto: StockQueryDto) {
    const where: any = {};
    if (dto.name) {
      where.product = { name: { contains: dto.name }, deletedAt: null };
    }

    const [list, total] = await Promise.all([
      this.prisma.productStockLog.findMany({
        where,
        skip: dto.skip,
        take: dto.take,
        orderBy: { createdAt: 'desc' },
        include: {
          product: { select: { id: true, name: true } },
          sku: { select: { id: true, specs: true } },
        },
      }),
      this.prisma.productStockLog.count({ where }),
    ]);

    return paginate(
      list.map((log) => ({
        id: log.id.toString(),
        productId: log.productId.toString(),
        skuId: log.skuId.toString(),
        productName: log.product?.name || '',
        skuName: this.formatSpecs(log.sku?.specs),
        type: log.type === 1 ? 'out' : 'in',
        quantity: log.quantity,
        beforeStock: log.beforeStock,
        afterStock: log.afterStock,
        reason: log.reason,
        operator: log.operatorId?.toString() || '-',
        createTime: log.createdAt,
        createdAt: log.createdAt,
      })),
      total,
      dto.page,
      dto.pageSize,
    );
  }

  async adjust(dto: StockAdjustDto, adminUserId?: string) {
    const sku = await this.prisma.productSku.findFirst({
      where: { id: BigInt(dto.skuId), product: { deletedAt: null } },
      include: { product: { select: { id: true, name: true } } },
    });

    if (!sku) {
      throw new NotFoundException('SKU不存在');
    }

    if (dto.type === 'out' && sku.stock < dto.quantity) {
      throw new BadRequestException('库存不足');
    }

    const beforeStock = sku.stock;
    const afterStock = dto.type === 'in' ? beforeStock + dto.quantity : beforeStock - dto.quantity;

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.productSku.updateMany({
        where: { id: sku.id, stock: beforeStock },
        data: { stock: afterStock },
      });
      if (updated.count === 0) {
        throw new BadRequestException('库存已变更，请刷新后重试');
      }

      await tx.productStockLog.create({
        data: {
          productId: sku.productId,
          skuId: sku.id,
          type: dto.type === 'in' ? 2 : 1,
          quantity: dto.quantity,
          beforeStock,
          afterStock,
          reason: dto.reason,
          operatorId: adminUserId ? BigInt(adminUserId) : undefined,
        },
      });

      return tx.productSku.findFirst({ where: { id: sku.id } });
    });

    this.logger.log(`管理员调整库存：SKU ${sku.id.toString()} ${dto.type} ${dto.quantity}`);
    return {
      skuId: result!.id.toString(),
      productId: result!.productId.toString(),
      beforeStock,
      afterStock,
    };
  }

  private formatSpecs(specs: any): string {
    if (!specs) return '默认规格';
    if (typeof specs === 'string') return specs;
    if (Array.isArray(specs)) return specs.join(' / ');
    if (typeof specs === 'object') return Object.values(specs).filter(Boolean).join(' / ') || '默认规格';
    return '默认规格';
  }
}
