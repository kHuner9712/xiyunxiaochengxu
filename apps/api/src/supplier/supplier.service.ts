import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { paginate } from '@baby-mall/shared';

@Injectable()
export class SupplierService {
  private readonly logger = new Logger(SupplierService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(dto: PaginationDto & { keyword?: string; status?: number }) {
    const where: any = { deletedAt: null };
    if (dto.keyword) where.name = { contains: dto.keyword };
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
    this.logger.log(`管理员查询供应商列表，共${total}条`);
    return paginate(
      list.map((s) => ({ ...s, id: s.id.toString() })),
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
    const existing = await this.prisma.supplier.findFirst({
      where: { name: dto.name, deletedAt: null },
    });
    if (existing) throw new BadRequestException('供应商名称已存在');

    const data: any = {
      name: dto.name,
      contactName: dto.contactName,
      contactPhone: dto.contactPhone,
      address: dto.address,
      businessLicense: dto.businessLicense,
      settlementType: dto.settlementType,
      remark: dto.remark,
    };

    if (dto.cooperationStartDate) {
      data.cooperationStartDate = new Date(dto.cooperationStartDate);
    }

    const result = await this.prisma.supplier.create({ data });
    this.logger.log(`创建供应商：${result.id} - ${dto.name}`);
    return { ...result, id: result.id.toString() };
  }

  async update(id: string, dto: Partial<CreateSupplierDto>) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: BigInt(id), deletedAt: null },
    });
    if (!supplier) throw new NotFoundException('供应商不存在');

    if (dto.name && dto.name !== supplier.name) {
      const existing = await this.prisma.supplier.findFirst({
        where: { name: dto.name, deletedAt: null, id: { not: BigInt(id) } },
      });
      if (existing) throw new BadRequestException('供应商名称已存在');
    }

    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.contactName !== undefined) updateData.contactName = dto.contactName;
    if (dto.contactPhone !== undefined) updateData.contactPhone = dto.contactPhone;
    if (dto.address !== undefined) updateData.address = dto.address;
    if (dto.businessLicense !== undefined) updateData.businessLicense = dto.businessLicense;
    if (dto.settlementType !== undefined) updateData.settlementType = dto.settlementType;
    if (dto.remark !== undefined) updateData.remark = dto.remark;
    if (dto.cooperationStartDate !== undefined) {
      updateData.cooperationStartDate = dto.cooperationStartDate
        ? new Date(dto.cooperationStartDate)
        : null;
    }

    const result = await this.prisma.supplier.update({
      where: { id: BigInt(id) },
      data: updateData,
    });
    this.logger.log(`更新供应商：${id}`);
    return { ...result, id: result.id.toString() };
  }

  async delete(id: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: BigInt(id), deletedAt: null },
    });
    if (!supplier) throw new NotFoundException('供应商不存在');

    const products = await this.prisma.product.count({
      where: { supplierId: BigInt(id), deletedAt: null },
    });
    if (products > 0) throw new BadRequestException('供应商下存在商品，无法删除');

    const result = await this.prisma.supplier.update({
      where: { id: BigInt(id) },
      data: { deletedAt: new Date() },
    });
    this.logger.log(`删除供应商：${id}`);
    return { ...result, id: result.id.toString() };
  }

  async updateStatus(id: string, status: number) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: BigInt(id), deletedAt: null },
    });
    if (!supplier) throw new NotFoundException('供应商不存在');

    const result = await this.prisma.supplier.update({
      where: { id: BigInt(id) },
      data: { status },
    });
    this.logger.log(`更新供应商状态：${id} -> ${status}`);
    return { ...result, id: result.id.toString() };
  }
}
