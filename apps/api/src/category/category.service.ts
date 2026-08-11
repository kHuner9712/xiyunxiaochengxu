import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
    const parentId = dto.parentId ? BigInt(dto.parentId) : 0n;
    const result = await this.prisma.$transaction(async (tx) => {
      await this.assertValidParentChain(tx, parentId, null);
      return tx.productCategory.create({
        data: {
          parentId,
          name: dto.name,
          icon: dto.icon,
          complianceConfig: dto.complianceConfig as any,
          sortOrder: dto.sortOrder ?? 0,
          isShow: dto.isShow ?? 1,
        },
      });
    });
    this.logger.log(`创建分类：${result.id} - ${dto.name}`);
    return { ...result, id: result.id.toString(), parentId: result.parentId.toString() };
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const categoryId = BigInt(id);
    const result = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: bigint; parentId: bigint }>>`
        SELECT id, parent_id AS parentId
        FROM product_categories
        WHERE id = ${categoryId} AND deleted_at IS NULL
        FOR UPDATE
      `;
      if (locked.length === 0) throw new NotFoundException('分类不存在');

      const updateData: any = {};
      if (dto.parentId !== undefined) {
        const parentId = BigInt(dto.parentId);
        if (parentId === categoryId) {
          throw new BadRequestException('不能将分类设置为自己的子分类');
        }
        await this.assertValidParentChain(tx, parentId, categoryId);
        updateData.parentId = parentId;
      }
      if (dto.name !== undefined) updateData.name = dto.name;
      if (dto.icon !== undefined) updateData.icon = dto.icon;
      if (dto.complianceConfig !== undefined) updateData.complianceConfig = dto.complianceConfig as any;
      if (dto.sortOrder !== undefined) updateData.sortOrder = dto.sortOrder;
      if (dto.isShow !== undefined) updateData.isShow = dto.isShow;

      return tx.productCategory.update({
        where: { id: categoryId },
        data: updateData,
      });
    });
    this.logger.log(`更新分类：${id}`);
    return { ...result, id: result.id.toString(), parentId: result.parentId.toString() };
  }

  async delete(id: string) {
    const categoryId = BigInt(id);
    const result = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: bigint }>>`
        SELECT id
        FROM product_categories
        WHERE id = ${categoryId} AND deleted_at IS NULL
        FOR UPDATE
      `;
      if (locked.length === 0) throw new NotFoundException('分类不存在');

      const children = await tx.productCategory.count({
        where: { parentId: categoryId, deletedAt: null },
      });
      if (children > 0) throw new BadRequestException('存在子分类，无法删除');

      const products = await tx.product.count({
        where: { categoryId, deletedAt: null },
      });
      if (products > 0) throw new BadRequestException('分类下存在商品，无法删除');

      return tx.productCategory.update({
        where: { id: categoryId },
        data: { deletedAt: new Date() },
      });
    });
    this.logger.log(`删除分类：${id}`);
    return { ...result, id: result.id.toString(), parentId: result.parentId.toString() };
  }

  private async assertValidParentChain(
    tx: Prisma.TransactionClient,
    parentId: bigint,
    currentCategoryId: bigint | null,
  ) {
    if (parentId === 0n) return;

    const visited = new Set<string>();
    let cursor = parentId;
    for (let depth = 0; depth < 1000; depth += 1) {
      if (currentCategoryId !== null && cursor === currentCategoryId) {
        throw new BadRequestException('不能将分类移动到自己的子孙分类下');
      }
      const key = cursor.toString();
      if (visited.has(key)) {
        throw new BadRequestException('父级分类链存在循环，请先修复分类结构');
      }
      visited.add(key);

      const rows = await tx.$queryRaw<Array<{ id: bigint; parentId: bigint }>>`
        SELECT id, parent_id AS parentId
        FROM product_categories
        WHERE id = ${cursor} AND deleted_at IS NULL
        FOR UPDATE
      `;
      if (rows.length === 0) {
        throw new BadRequestException('父级分类不存在或已删除，请重新选择父级分类');
      }
      cursor = rows[0].parentId;
      if (cursor === 0n) return;
    }

    throw new BadRequestException('分类层级过深，无法安全保存');
  }

  private buildTree(categories: any[], parentId: bigint = 0n): any[] {
    return categories
      .filter((c) => c.parentId === parentId)
      .map((c) => ({
        ...c,
        id: c.id.toString(),
        parentId: c.parentId.toString(),
        icon: c.icon || '/static/default-cover.png',
        children: this.buildTree(categories, c.id),
      }));
  }
}
