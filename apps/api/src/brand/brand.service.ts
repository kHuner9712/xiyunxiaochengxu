import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CreateBrandDto } from './dto/create-brand.dto';
import { paginate } from '@baby-mall/shared';

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
    const brand = await this.prisma.brand.findFirst({
      where: { id: BigInt(id), deletedAt: null },
    });
    if (!brand) throw new NotFoundException('品牌不存在');
    return { ...brand, id: brand.id.toString() };
  }

  async create(dto: CreateBrandDto) {
    const existing = await this.prisma.brand.findFirst({
      where: { name: dto.name, deletedAt: null },
    });
    if (existing) throw new BadRequestException('品牌名称已存在');

    const result = await this.prisma.brand.create({
      data: {
        name: dto.name,
        logo: dto.logo,
        description: dto.description,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
    this.logger.log(`创建品牌：${result.id} - ${dto.name}`);
    return { ...result, id: result.id.toString() };
  }

  async update(id: string, dto: Partial<CreateBrandDto>) {
    const brand = await this.prisma.brand.findFirst({
      where: { id: BigInt(id), deletedAt: null },
    });
    if (!brand) throw new NotFoundException('品牌不存在');

    if (dto.name && dto.name !== brand.name) {
      const existing = await this.prisma.brand.findFirst({
        where: { name: dto.name, deletedAt: null, id: { not: BigInt(id) } },
      });
      if (existing) throw new BadRequestException('品牌名称已存在');
    }

    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.logo !== undefined) updateData.logo = dto.logo;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.sortOrder !== undefined) updateData.sortOrder = dto.sortOrder;

    const result = await this.prisma.brand.update({
      where: { id: BigInt(id) },
      data: updateData,
    });
    this.logger.log(`更新品牌：${id}`);
    return { ...result, id: result.id.toString() };
  }

  async delete(id: string) {
    const brand = await this.prisma.brand.findFirst({
      where: { id: BigInt(id), deletedAt: null },
    });
    if (!brand) throw new NotFoundException('品牌不存在');

    const products = await this.prisma.product.count({
      where: { brandId: BigInt(id), deletedAt: null },
    });
    if (products > 0) throw new BadRequestException('品牌下存在商品，无法删除');

    const result = await this.prisma.brand.update({
      where: { id: BigInt(id) },
      data: { deletedAt: new Date() },
    });
    this.logger.log(`删除品牌：${id}`);
    return { ...result, id: result.id.toString() };
  }
}
