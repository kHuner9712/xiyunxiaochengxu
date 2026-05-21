import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoryService {
  private readonly logger = new Logger(CategoryService.name);

  constructor(private prisma: PrismaService) {}

  async findTree() {
    const categories = await this.prisma.productCategory.findMany({
      where: { deletedAt: null, isShow: 1 },
      orderBy: { sortOrder: 'asc' },
    });
    this.logger.log(`查询前台分类树，共${categories.length}条`);
    return this.buildTree(categories);
  }

  async findAllAdmin() {
    const categories = await this.prisma.productCategory.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    });
    this.logger.log(`管理员查询分类树，共${categories.length}条`);
    return this.buildTree(categories);
  }

  async findById(id: string) {
    const category = await this.prisma.productCategory.findFirst({
      where: { id: BigInt(id), deletedAt: null },
    });
    if (!category) throw new NotFoundException('分类不存在');
    return { ...category, id: category.id.toString(), parentId: category.parentId.toString() };
  }

  async create(dto: CreateCategoryDto) {
    const result = await this.prisma.productCategory.create({
      data: {
        parentId: dto.parentId ? BigInt(dto.parentId) : 0n,
        name: dto.name,
        icon: dto.icon,
        sortOrder: dto.sortOrder ?? 0,
        isShow: dto.isShow ?? 1,
      },
    });
    this.logger.log(`创建分类：${result.id} - ${dto.name}`);
    return { ...result, id: result.id.toString(), parentId: result.parentId.toString() };
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const category = await this.prisma.productCategory.findFirst({
      where: { id: BigInt(id), deletedAt: null },
    });
    if (!category) throw new NotFoundException('分类不存在');

    if (dto.parentId !== undefined && BigInt(dto.parentId) === BigInt(id)) {
      throw new BadRequestException('不能将分类设置为自己的子分类');
    }

    const updateData: any = {};
    if (dto.parentId !== undefined) updateData.parentId = BigInt(dto.parentId);
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.icon !== undefined) updateData.icon = dto.icon;
    if (dto.sortOrder !== undefined) updateData.sortOrder = dto.sortOrder;
    if (dto.isShow !== undefined) updateData.isShow = dto.isShow;

    const result = await this.prisma.productCategory.update({
      where: { id: BigInt(id) },
      data: updateData,
    });
    this.logger.log(`更新分类：${id}`);
    return { ...result, id: result.id.toString(), parentId: result.parentId.toString() };
  }

  async delete(id: string) {
    const category = await this.prisma.productCategory.findFirst({
      where: { id: BigInt(id), deletedAt: null },
    });
    if (!category) throw new NotFoundException('分类不存在');

    const children = await this.prisma.productCategory.count({
      where: { parentId: BigInt(id), deletedAt: null },
    });
    if (children > 0) throw new BadRequestException('存在子分类，无法删除');

    const products = await this.prisma.product.count({
      where: { categoryId: BigInt(id), deletedAt: null },
    });
    if (products > 0) throw new BadRequestException('分类下存在商品，无法删除');

    const result = await this.prisma.productCategory.update({
      where: { id: BigInt(id) },
      data: { deletedAt: new Date() },
    });
    this.logger.log(`删除分类：${id}`);
    return { ...result, id: result.id.toString(), parentId: result.parentId.toString() };
  }

  private buildTree(categories: any[], parentId: bigint = 0n): any[] {
    return categories
      .filter((c) => c.parentId === parentId)
      .map((c) => ({
        ...c,
        id: c.id.toString(),
        parentId: c.parentId.toString(),
        children: this.buildTree(categories, c.id),
      }));
  }
}
