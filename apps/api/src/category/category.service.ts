import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

const CATEGORY_CREATE_EVENT = 'category_create';
const SERIALIZABLE_RETRY_LIMIT = 3;

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
    const categoryId = parsePositiveBigIntId(id, '分类');
    const category = await this.prisma.productCategory.findFirst({
      where: { id: categoryId, deletedAt: null },
    });
    if (!category) throw new NotFoundException('分类不存在');
    return this.serializeCategory(category);
  }

  async create(dto: CreateCategoryDto) {
    const requestId = dto.clientRequestId?.trim() || null;
    const parentId = dto.parentId ? BigInt(dto.parentId) : 0n;
    const createData = {
      parentId,
      name: dto.name.trim(),
      icon: dto.icon,
      complianceConfig: dto.complianceConfig as any,
      sortOrder: dto.sortOrder ?? 0,
      isShow: dto.isShow ?? 1,
    };
    const fingerprint = this.createRequestFingerprint(createData);

    for (let attempt = 0; attempt < SERIALIZABLE_RETRY_LIMIT; attempt += 1) {
      try {
        const result = await this.prisma.$transaction(
          async (tx) => {
            if (requestId) {
              const handled = await tx.businessEvent.findFirst({
                where: {
                  eventType: CATEGORY_CREATE_EVENT,
                  bizType: 'category',
                  bizId: requestId,
                },
                orderBy: { id: 'desc' },
              });
              if (handled) {
                const eventPayload = this.readCreateEventPayload(handled.payload);
                if (eventPayload.fingerprint !== fingerprint) {
                  throw new BadRequestException('分类创建请求ID已被其他操作使用，请重新提交');
                }
                const replay = await tx.productCategory.findFirst({
                  where: { id: parsePositiveBigIntId(eventPayload.categoryId, '分类') },
                });
                if (!replay) {
                  throw new BadRequestException('该分类创建请求已处理，但分类记录不存在，请刷新分类树后重试');
                }
                if (replay.deletedAt) {
                  throw new BadRequestException('该分类创建请求已处理，但分类已删除，请刷新分类树');
                }
                return { category: replay, replayed: true };
              }
            }

            await this.assertValidParentChain(tx, parentId, null);
            const category = await tx.productCategory.create({ data: createData });

            if (requestId) {
              await tx.businessEvent.create({
                data: {
                  eventType: CATEGORY_CREATE_EVENT,
                  bizType: 'category',
                  bizId: requestId,
                  level: 'info',
                  message: '分类创建请求已处理',
                  payload: {
                    categoryId: category.id.toString(),
                    fingerprint,
                  },
                },
              });
            }

            return { category, replayed: false };
          },
          { isolationLevel: 'Serializable' },
        );

        this.logger.log(
          `创建分类：${result.category.id} - ${createData.name}${result.replayed ? '（幂等重放）' : ''}`,
        );
        return this.serializeCategory(result.category);
      } catch (error: any) {
        if (error?.code === 'P2034' && attempt + 1 < SERIALIZABLE_RETRY_LIMIT) continue;
        throw error;
      }
    }

    throw new Error('分类创建事务重试次数已耗尽');
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const categoryId = parsePositiveBigIntId(id, '分类');
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
    return this.serializeCategory(result);
  }

  async delete(id: string) {
    const categoryId = parsePositiveBigIntId(id, '分类');
    const result = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: bigint }>>`
        SELECT id
        FROM product_categories
        WHERE id = ${categoryId}
        FOR UPDATE
      `;
      if (locked.length === 0) throw new NotFoundException('分类不存在');

      const category = await tx.productCategory.findFirst({ where: { id: categoryId } });
      if (!category) throw new NotFoundException('分类不存在');
      if (category.deletedAt) return { category, replayed: true };

      const children = await tx.productCategory.count({
        where: { parentId: categoryId, deletedAt: null },
      });
      if (children > 0) throw new BadRequestException('存在子分类，无法删除');

      const products = await tx.product.count({
        where: { categoryId, deletedAt: null },
      });
      if (products > 0) throw new BadRequestException('分类下存在商品，无法删除');

      const deleted = await tx.productCategory.update({
        where: { id: categoryId },
        data: { deletedAt: new Date() },
      });
      return { category: deleted, replayed: false };
    });
    this.logger.log(`删除分类：${id}${result.replayed ? '（幂等重放）' : ''}`);
    return this.serializeCategory(result.category);
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

  private createRequestFingerprint(data: {
    parentId: bigint;
    name: string;
    icon?: string;
    complianceConfig?: unknown;
    sortOrder: number;
    isShow: number;
  }) {
    const complianceConfig = data.complianceConfig && typeof data.complianceConfig === 'object'
      ? data.complianceConfig as Record<string, unknown>
      : null;
    return JSON.stringify({
      parentId: data.parentId.toString(),
      name: data.name,
      icon: data.icon ?? null,
      sortOrder: data.sortOrder,
      isShow: data.isShow,
      complianceConfig: complianceConfig ? {
        isFood: complianceConfig.isFood === true,
        isHealthSupplement: complianceConfig.isHealthSupplement === true,
        isInfantFormula: complianceConfig.isInfantFormula === true,
        requiresCertImages: complianceConfig.requiresCertImages === true,
        requiredComplianceFields: Array.isArray(complianceConfig.requiredComplianceFields)
          ? [...complianceConfig.requiredComplianceFields]
          : [],
      } : null,
    });
  }

  private readCreateEventPayload(payload: unknown): { categoryId: string; fingerprint: string } {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new BadRequestException('分类创建请求记录异常，请刷新分类树后重试');
    }
    const record = payload as Record<string, unknown>;
    const categoryId = typeof record.categoryId === 'string' ? record.categoryId : '';
    const fingerprint = typeof record.fingerprint === 'string' ? record.fingerprint : '';
    if (!/^[1-9]\d*$/.test(categoryId) || !fingerprint) {
      throw new BadRequestException('分类创建请求记录异常，请刷新分类树后重试');
    }
    return { categoryId, fingerprint };
  }

  private serializeCategory(category: any) {
    return {
      ...category,
      id: category.id.toString(),
      parentId: category.parentId.toString(),
    };
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
