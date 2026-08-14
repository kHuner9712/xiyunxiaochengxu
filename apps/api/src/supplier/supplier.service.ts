import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { paginate } from '@baby-mall/shared';

const SUPPLIER_CREATE_EVENT = 'supplier_create';
const SERIALIZABLE_RETRY_LIMIT = 3;

@Injectable()
export class SupplierService {
  private readonly logger = new Logger(SupplierService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(dto: PaginationDto & { keyword?: string; name?: string; contactPhone?: string; status?: number }) {
    const where: any = { deletedAt: null };
    if (dto.keyword) where.name = { contains: dto.keyword };
    if (dto.name) where.name = { contains: dto.name };
    if (dto.contactPhone) where.contactPhone = { contains: dto.contactPhone };
    if (dto.status !== undefined) where.status = dto.status;

    const [list, total] = await Promise.all([
      this.prisma.supplier.findMany({
        where,
        skip: dto.skip,
        take: dto.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.supplier.count({ where }),
    ]);
    const supplierIds = list.map((supplier) => supplier.id);
    const productCounts = supplierIds.length
      ? await this.prisma.product.groupBy({
          by: ['supplierId'],
          where: {
            supplierId: { in: supplierIds },
            deletedAt: null,
          },
          _count: { _all: true },
        })
      : [];
    const productCountMap = new Map(
      productCounts
        .filter((row) => row.supplierId !== null)
        .map((row) => [row.supplierId!.toString(), row._count._all]),
    );

    this.logger.log(`管理员查询供应商列表，共${total}条`);
    return paginate(
      list.map((supplier) => ({
        ...supplier,
        id: supplier.id.toString(),
        productCount: productCountMap.get(supplier.id.toString()) ?? 0,
      })),
      total,
      dto.page,
      dto.pageSize,
    );
  }

  async findById(id: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: BigInt(id), deletedAt: null },
    });
    if (!supplier) throw new NotFoundException('供应商不存在');
    return { ...supplier, id: supplier.id.toString() };
  }

  async create(dto: CreateSupplierDto) {
    const requestId = dto.clientRequestId?.trim() || null;
    const createData = this.buildCreateData(dto);
    const fingerprint = this.createRequestFingerprint(createData);
    let attempt = 0;

    while (true) {
      try {
        const result = await this.prisma.$transaction(
          async (tx) => {
            if (requestId) {
              const handled = await tx.businessEvent.findFirst({
                where: {
                  eventType: SUPPLIER_CREATE_EVENT,
                  bizType: 'supplier',
                  bizId: requestId,
                },
                orderBy: { id: 'desc' },
              });
              if (handled) {
                const eventPayload = this.readCreateEventPayload(handled.payload);
                if (eventPayload.fingerprint !== fingerprint) {
                  throw new BadRequestException('供应商创建请求ID已被其他操作使用，请重新提交');
                }
                const replay = await tx.supplier.findFirst({
                  where: { id: BigInt(eventPayload.supplierId) },
                });
                if (!replay) {
                  throw new BadRequestException('该供应商创建请求已处理，请刷新供应商列表后重试');
                }
                return { supplier: replay, replayed: true };
              }
            }

            const existing = await tx.supplier.findFirst({
              where: { name: createData.name, deletedAt: null },
            });
            if (existing) throw new BadRequestException('供应商名称已存在');

            const supplier = await tx.supplier.create({ data: createData });
            if (requestId) {
              await tx.businessEvent.create({
                data: {
                  eventType: SUPPLIER_CREATE_EVENT,
                  bizType: 'supplier',
                  bizId: requestId,
                  level: 'info',
                  message: '供应商创建请求已处理',
                  payload: {
                    supplierId: supplier.id.toString(),
                    fingerprint,
                  },
                },
              });
            }
            return { supplier, replayed: false };
          },
          { isolationLevel: 'Serializable' },
        );

        this.logger.log(
          `创建供应商：${result.supplier.id} - ${createData.name}${result.replayed ? '（幂等重放）' : ''}`,
        );
        return { ...result.supplier, id: result.supplier.id.toString() };
      } catch (error: any) {
        attempt += 1;
        if (error?.code === 'P2034' && attempt < SERIALIZABLE_RETRY_LIMIT) {
          continue;
        }
        throw error;
      }
    }
  }

  async update(id: string, dto: UpdateSupplierDto) {
    const supplierId = BigInt(id);
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, deletedAt: null },
    });
    if (!supplier) throw new NotFoundException('供应商不存在');

    if (dto.name && dto.name !== supplier.name) {
      const existing = await this.prisma.supplier.findFirst({
        where: { name: dto.name, deletedAt: null, id: { not: supplierId } },
      });
      if (existing) throw new BadRequestException('供应商名称已存在');
    }

    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.contactName !== undefined) updateData.contactName = dto.contactName;
    if (dto.contactPhone !== undefined) updateData.contactPhone = dto.contactPhone;
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.address !== undefined) updateData.address = dto.address;
    if (dto.businessLicense !== undefined) updateData.businessLicense = dto.businessLicense;
    if (dto.settlementType !== undefined) updateData.settlementType = dto.settlementType;
    if (dto.remark !== undefined) updateData.remark = dto.remark;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.cooperationStartDate !== undefined) {
      updateData.cooperationStartDate = dto.cooperationStartDate
        ? new Date(dto.cooperationStartDate)
        : null;
    }

    const result = dto.status === 0 && supplier.status !== 0
      ? await this.updateWithDeactivationGuard(supplierId, updateData)
      : await this.prisma.supplier.update({
          where: { id: supplierId },
          data: updateData,
        });
    this.logger.log(`更新供应商：${id}`);
    return { ...result, id: result.id.toString() };
  }

  async delete(id: string) {
    const supplierId = BigInt(id);
    const result = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: bigint }>>`
        SELECT id
        FROM suppliers
        WHERE id = ${supplierId}
        FOR UPDATE
      `;
      if (locked.length === 0) throw new NotFoundException('供应商不存在');

      const supplier = await tx.supplier.findFirst({ where: { id: supplierId } });
      if (!supplier) throw new NotFoundException('供应商不存在');
      if (supplier.deletedAt) {
        return { supplier, replayed: true };
      }

      const products = await tx.product.count({
        where: { supplierId, deletedAt: null },
      });
      if (products > 0) throw new BadRequestException('供应商下存在商品，无法删除');

      const deleted = await tx.supplier.update({
        where: { id: supplierId },
        data: { deletedAt: new Date() },
      });
      return { supplier: deleted, replayed: false };
    });
    this.logger.log(`删除供应商：${id}${result.replayed ? '（幂等重放）' : ''}`);
    return { ...result.supplier, id: result.supplier.id.toString() };
  }

  async updateStatus(id: string, status: number) {
    const supplierId = BigInt(id);
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, deletedAt: null },
    });
    if (!supplier) throw new NotFoundException('供应商不存在');

    const result = status === 0 && supplier.status !== 0
      ? await this.updateWithDeactivationGuard(supplierId, { status })
      : await this.prisma.supplier.update({
          where: { id: supplierId },
          data: { status },
        });
    this.logger.log(`更新供应商状态：${id} -> ${status}`);
    return { ...result, id: result.id.toString() };
  }

  private buildCreateData(dto: CreateSupplierDto) {
    const data: any = {
      name: dto.name.trim(),
      contactName: dto.contactName,
      contactPhone: dto.contactPhone,
      email: dto.email,
      address: dto.address,
      businessLicense: dto.businessLicense,
      settlementType: dto.settlementType,
      remark: dto.remark,
      status: dto.status ?? 1,
    };
    if (!data.name) throw new BadRequestException('供应商名称不能为空');
    if (dto.cooperationStartDate) {
      data.cooperationStartDate = new Date(dto.cooperationStartDate);
    }
    return data;
  }

  private createRequestFingerprint(data: Record<string, any>) {
    return JSON.stringify({
      name: data.name,
      contactName: data.contactName ?? null,
      contactPhone: data.contactPhone ?? null,
      email: data.email ?? null,
      address: data.address ?? null,
      businessLicense: data.businessLicense ?? null,
      cooperationStartDate: data.cooperationStartDate instanceof Date
        ? data.cooperationStartDate.toISOString()
        : null,
      settlementType: data.settlementType ?? null,
      remark: data.remark ?? null,
      status: data.status,
    });
  }

  private readCreateEventPayload(payload: unknown): { supplierId: string; fingerprint: string } {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new BadRequestException('供应商创建请求记录异常，请刷新后重试');
    }
    const record = payload as Record<string, unknown>;
    const supplierId = typeof record.supplierId === 'string' ? record.supplierId : '';
    const fingerprint = typeof record.fingerprint === 'string' ? record.fingerprint : '';
    if (!/^[1-9]\d*$/.test(supplierId) || !fingerprint) {
      throw new BadRequestException('供应商创建请求记录异常，请刷新后重试');
    }
    return { supplierId, fingerprint };
  }

  private async updateWithDeactivationGuard(supplierId: bigint, data: Record<string, any>) {
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: bigint }>>`
        SELECT id
        FROM suppliers
        WHERE id = ${supplierId} AND deleted_at IS NULL
        FOR UPDATE
      `;
      if (locked.length === 0) throw new NotFoundException('供应商不存在');

      const publishedProducts = await tx.product.count({
        where: {
          supplierId,
          deletedAt: null,
          status: 1,
        },
      });
      if (publishedProducts > 0) {
        throw new BadRequestException(
          `该供应商仍有${publishedProducts}个上架商品，请先下架后再停用合作`,
        );
      }

      return tx.supplier.update({
        where: { id: supplierId },
        data,
      });
    });
  }
}
