import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductService } from './product.service';

@Injectable()
export class ProductionProductService extends ProductService {
  constructor(private readonly productionPrisma: PrismaService) {
    super(productionPrisma);
  }

  override async create(dto: CreateProductDto) {
    const categoryId = parsePositiveBigIntId(String(dto.categoryId), '分类');
    const brandId = dto.brandId ? parsePositiveBigIntId(String(dto.brandId), '品牌') : null;
    const supplierId = dto.supplierId ? parsePositiveBigIntId(String(dto.supplierId), '供应商') : null;

    const productId = await this.productionPrisma.$transaction(async (tx) => {
      await this.assertCategoryAssignable(tx, categoryId);
      if (brandId) await this.assertBrandAssignable(tx, brandId);
      if (supplierId) await this.assertSupplierAssignable(tx, supplierId);

      const product = await tx.product.create({
        data: {
          name: dto.name,
          categoryId,
          productType: dto.productType ?? 'physical',
          fulfillmentType: dto.fulfillmentType ?? 'delivery',
          businessCategory: dto.businessCategory ?? 'other',
          brandId,
          supplierId,
          mainImage: dto.mainImage,
          videoUrl: dto.videoUrl,
          images: dto.images,
          description: dto.description,
          attributes: dto.attributes,
          servicePromise: dto.servicePromise,
          recommendAgeMin: dto.recommendAgeMin,
          recommendAgeMax: dto.recommendAgeMax,
          isPeriodPurchase: dto.isPeriodPurchase ?? 0,
          sortOrder: dto.sortOrder ?? 0,
          isRecommend: dto.isRecommend ?? 0,
          status: 3,
          skus: {
            create: dto.skus.map((sku) => ({
              skuCode: sku.skuCode?.trim() || this.generateProductionCreateSkuCode(),
              specs: sku.specs,
              price: sku.price,
              originalPrice: sku.originalPrice,
              costPrice: sku.costPrice,
              stock: sku.stock ?? 0,
              image: sku.image,
              weight: sku.weight,
              barcode: sku.barcode,
            })),
          },
        },
        include: { skus: true },
      });

      const prices = product.skus.map((sku) => sku.price);
      if (prices.length > 0) {
        await tx.product.update({
          where: { id: product.id },
          data: {
            minPrice: Math.min(...prices),
            maxPrice: Math.max(...prices),
          },
        });
      }
      return product.id;
    });

    return super.findAdminById(productId.toString());
  }

  override async update(id: string, dto: UpdateProductDto) {
    const productId = parsePositiveBigIntId(id, '商品');

    await this.productionPrisma.$transaction(async (tx) => {
      const productLock = await tx.$queryRaw<Array<{
        id: bigint;
        categoryId: bigint;
        brandId: bigint | null;
        supplierId: bigint | null;
      }>>`
        SELECT
          id,
          category_id AS categoryId,
          brand_id AS brandId,
          supplier_id AS supplierId
        FROM products
        WHERE id = ${productId} AND deleted_at IS NULL
        FOR UPDATE
      `;
      if (productLock.length === 0) throw new NotFoundException('商品不存在');

      // Serialize SKU metadata edits with order stock changes. Existing SKU stock is inventory
      // state, not product metadata: an old edit form must never write a stale absolute stock value
      // over real orders. Stock changes belong to /admin/stock where CAS + stock logs are used.
      await tx.$queryRaw`
        SELECT id FROM product_skus WHERE product_id = ${productId} FOR UPDATE
      `;

      const updateData: any = {};
      if (dto.name !== undefined) updateData.name = dto.name;
      if (dto.categoryId !== undefined) {
        const nextCategoryId = parsePositiveBigIntId(String(dto.categoryId), '分类');
        if (nextCategoryId.toString() !== productLock[0].categoryId.toString()) {
          await this.assertCategoryAssignable(tx, nextCategoryId);
        }
        updateData.categoryId = nextCategoryId;
      }
      if (dto.productType !== undefined) updateData.productType = dto.productType;
      if (dto.fulfillmentType !== undefined) updateData.fulfillmentType = dto.fulfillmentType;
      if (dto.businessCategory !== undefined) updateData.businessCategory = dto.businessCategory;
      if (dto.brandId !== undefined) {
        const nextBrandId = dto.brandId ? parsePositiveBigIntId(String(dto.brandId), '品牌') : null;
        const brandChanged = String(nextBrandId ?? '') !== String(productLock[0].brandId ?? '');
        if (nextBrandId && brandChanged) await this.assertBrandAssignable(tx, nextBrandId);
        updateData.brandId = nextBrandId;
      }
      if (dto.supplierId !== undefined) {
        const nextSupplierId = dto.supplierId
          ? parsePositiveBigIntId(String(dto.supplierId), '供应商')
          : null;
        const supplierChanged = String(nextSupplierId ?? '') !== String(productLock[0].supplierId ?? '');
        if (nextSupplierId && supplierChanged) {
          await this.assertSupplierAssignable(tx, nextSupplierId);
        }
        updateData.supplierId = nextSupplierId;
      }
      if (dto.mainImage !== undefined) updateData.mainImage = dto.mainImage;
      if (dto.videoUrl !== undefined) updateData.videoUrl = dto.videoUrl;
      if (dto.images !== undefined) updateData.images = dto.images;
      if (dto.description !== undefined) updateData.description = dto.description;
      if (dto.attributes !== undefined) updateData.attributes = dto.attributes;
      if (dto.servicePromise !== undefined) updateData.servicePromise = dto.servicePromise;
      if (dto.recommendAgeMin !== undefined) updateData.recommendAgeMin = dto.recommendAgeMin;
      if (dto.recommendAgeMax !== undefined) updateData.recommendAgeMax = dto.recommendAgeMax;
      if (dto.isPeriodPurchase !== undefined) updateData.isPeriodPurchase = dto.isPeriodPurchase;
      if (dto.sortOrder !== undefined) updateData.sortOrder = dto.sortOrder;
      if (dto.isRecommend !== undefined) updateData.isRecommend = dto.isRecommend;

      if (dto.skus !== undefined) {
        const existingSkus = await tx.productSku.findMany({ where: { productId } });
        const existingByCode = new Map(
          existingSkus
            .filter((sku) => !!sku.skuCode)
            .map((sku) => [sku.skuCode as string, sku]),
        );
        const incomingCodes = dto.skus
          .map((sku) => sku.skuCode?.trim())
          .filter((value): value is string => !!value);
        if (new Set(incomingCodes).size !== incomingCodes.length) {
          throw new BadRequestException('SKU编码不能重复');
        }

        const activeSkuIds: bigint[] = [];
        for (const incoming of dto.skus) {
          const skuCode = incoming.skuCode?.trim() || this.generateProductionSkuCode(productId);
          const existing = existingByCode.get(skuCode);
          if (existing) {
            if (incoming.stock !== undefined && incoming.stock !== existing.stock) {
              throw new BadRequestException(
                `SKU ${skuCode} 库存已变化或正在商品编辑页修改库存；请刷新商品后，通过“库存管理”执行入库/出库`,
              );
            }
            const updated = await tx.productSku.update({
              where: { id: existing.id },
              data: {
                skuCode,
                specs: incoming.specs,
                price: incoming.price,
                originalPrice: incoming.originalPrice,
                costPrice: incoming.costPrice,
                image: incoming.image,
                weight: incoming.weight,
                barcode: incoming.barcode,
                status: 1,
                // Deliberately preserve existing.stock.
              },
            });
            activeSkuIds.push(updated.id);
            continue;
          }

          const created = await tx.productSku.create({
            data: {
              productId,
              skuCode,
              specs: incoming.specs,
              price: incoming.price,
              originalPrice: incoming.originalPrice,
              costPrice: incoming.costPrice,
              stock: incoming.stock ?? 0,
              image: incoming.image,
              weight: incoming.weight,
              barcode: incoming.barcode,
              status: 1,
            },
          });
          activeSkuIds.push(created.id);
          if ((incoming.stock ?? 0) > 0) {
            await tx.productStockLog.create({
              data: {
                productId,
                skuId: created.id,
                type: 2,
                quantity: incoming.stock ?? 0,
                beforeStock: 0,
                afterStock: incoming.stock ?? 0,
                reason: '新增SKU初始库存',
              },
            });
          }
        }

        await tx.productSku.updateMany({
          where: { productId, id: { notIn: activeSkuIds } },
          data: { status: 2 },
        });

        const activeSkus = await tx.productSku.findMany({
          where: { productId, status: 1 },
          select: { price: true },
        });
        if (activeSkus.length === 0) throw new BadRequestException('商品至少需要一个有效SKU');
        updateData.minPrice = Math.min(...activeSkus.map((sku) => sku.price));
        updateData.maxPrice = Math.max(...activeSkus.map((sku) => sku.price));
      }

      await tx.product.update({ where: { id: productId }, data: updateData });
    });

    return super.findAdminById(id);
  }

  private async assertCategoryAssignable(tx: Prisma.TransactionClient, categoryId: bigint) {
    const rows = await tx.$queryRaw<Array<{ id: bigint }>>`
      SELECT id
      FROM product_categories
      WHERE id = ${categoryId}
        AND deleted_at IS NULL
      FOR UPDATE
    `;
    if (rows.length === 0) {
      throw new BadRequestException('分类不存在或已删除，请重新选择分类');
    }
  }

  private async assertBrandAssignable(tx: Prisma.TransactionClient, brandId: bigint) {
    const rows = await tx.$queryRaw<Array<{ id: bigint }>>`
      SELECT id
      FROM brands
      WHERE id = ${brandId}
        AND deleted_at IS NULL
      FOR UPDATE
    `;
    if (rows.length === 0) {
      throw new BadRequestException('品牌不存在或已删除，请重新选择品牌');
    }
  }

  private async assertSupplierAssignable(tx: Prisma.TransactionClient, supplierId: bigint) {
    const rows = await tx.$queryRaw<Array<{ id: bigint }>>`
      SELECT id
      FROM suppliers
      WHERE id = ${supplierId}
        AND deleted_at IS NULL
        AND status = 1
      FOR UPDATE
    `;
    if (rows.length === 0) {
      throw new BadRequestException('供应商不存在或已停用，请选择合作中的供应商');
    }
  }

  private generateProductionCreateSkuCode() {
    const random = crypto.randomUUID().replace(/-/g, '').slice(0, 22).toUpperCase();
    return `SKU-NEW-${random}`;
  }

  private generateProductionSkuCode(productId: bigint) {
    const random = crypto.randomUUID().replace(/-/g, '').slice(0, 18).toUpperCase();
    return `SKU-${productId.toString()}-${random}`;
  }
}
