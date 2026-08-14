import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductService } from './product.service';

const PRODUCT_CREATE_EVENT = 'product_create';
const SERIALIZABLE_RETRY_LIMIT = 3;

@Injectable()
export class ProductionProductService extends ProductService {
  constructor(private readonly productionPrisma: PrismaService) {
    super(productionPrisma);
  }

  override async create(dto: CreateProductDto) {
    const categoryId = parsePositiveBigIntId(String(dto.categoryId), '分类');
    const brandId = dto.brandId ? parsePositiveBigIntId(String(dto.brandId), '品牌') : null;
    const supplierId = dto.supplierId ? parsePositiveBigIntId(String(dto.supplierId), '供应商') : null;
    const requestId = dto.clientRequestId?.trim() || null;
    const fingerprint = this.createCreateRequestFingerprint(dto, categoryId, brandId, supplierId);

    for (let attempt = 0; attempt < SERIALIZABLE_RETRY_LIMIT; attempt += 1) {
      try {
        const result = await this.productionPrisma.$transaction(
          async (tx) => {
            // Check the durable request fact before current category/brand/supplier state. A retry
            // after a committed response loss must replay the original success even if catalog
            // metadata changed afterwards.
            if (requestId) {
              const handled = await tx.businessEvent.findFirst({
                where: {
                  eventType: PRODUCT_CREATE_EVENT,
                  bizType: 'product',
                  bizId: requestId,
                },
                orderBy: { id: 'desc' },
              });
              if (handled) {
                const eventPayload = this.readCreateEventPayload(handled.payload);
                if (eventPayload.fingerprint !== fingerprint) {
                  throw new BadRequestException('商品创建请求ID已被其他操作使用，请重新提交');
                }
                const replayProduct = await tx.product.findFirst({
                  where: { id: parsePositiveBigIntId(eventPayload.productId, '商品') },
                  select: { id: true, deletedAt: true },
                });
                if (!replayProduct) {
                  throw new BadRequestException('该商品创建请求已处理，但商品记录不存在，请刷新后重试');
                }
                if (replayProduct.deletedAt) {
                  throw new BadRequestException('该商品创建请求已处理，但商品已删除，请刷新商品列表');
                }
                return { productId: replayProduct.id, replayed: true };
              }
            }

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

            const initialStockLogs = product.skus
              .filter((sku) => sku.stock > 0)
              .map((sku) => ({
                productId: product.id,
                skuId: sku.id,
                type: 2,
                quantity: sku.stock,
                beforeStock: 0,
                afterStock: sku.stock,
                reason: '商品创建初始库存',
              }));
            if (initialStockLogs.length > 0) {
              await tx.productStockLog.createMany({ data: initialStockLogs });
            }

            if (requestId) {
              // Product, SKUs, initial stock ledger and request fact commit together. A transaction
              // retry therefore cannot leave a product without its durable idempotency marker.
              await tx.businessEvent.create({
                data: {
                  eventType: PRODUCT_CREATE_EVENT,
                  bizType: 'product',
                  bizId: requestId,
                  level: 'info',
                  message: '商品创建请求已处理',
                  payload: {
                    productId: product.id.toString(),
                    fingerprint,
                  },
                },
              });
            }

            return { productId: product.id, replayed: false };
          },
          { isolationLevel: 'Serializable' },
        );

        return super.findAdminById(result.productId.toString());
      } catch (error: any) {
        if (error?.code === 'P2034' && attempt + 1 < SERIALIZABLE_RETRY_LIMIT) {
          continue;
        }
        throw error;
      }
    }

    throw new Error('商品创建事务重试次数已耗尽');
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

  override async updateStatus(id: string, status: number) {
    const productId = parsePositiveBigIntId(id, '商品');
    if (status !== 1) {
      return super.updateStatus(productId.toString(), status);
    }

    await this.productionPrisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: bigint; supplierId: bigint | null }>>`
        SELECT id, supplier_id AS supplierId
        FROM products
        WHERE id = ${productId} AND deleted_at IS NULL
        FOR UPDATE
      `;
      if (locked.length === 0) throw new NotFoundException('商品不存在');

      const product = await tx.product.findUnique({
        where: { id: productId },
        include: { category: true },
      });
      if (!product || product.deletedAt) throw new NotFoundException('商品不存在');
      if (product.minPrice === null) {
        throw new BadRequestException('商品无有效SKU，无法上架');
      }

      if (locked[0].supplierId) {
        // Supplier deactivation uses the same row lock. This makes "publish product" and
        // "deactivate supplier" mutually exclusive and preserves the invariant that a live
        // product can never point at an inactive supplier.
        await this.assertSupplierAssignable(tx, locked[0].supplierId);
      }

      const validateComplianceBeforePublish = (this as any).validateProductComplianceBeforePublish;
      if (typeof validateComplianceBeforePublish !== 'function') {
        throw new Error('ProductService publish compliance validator is unavailable');
      }
      validateComplianceBeforePublish.call(this, product);

      await tx.product.update({
        where: { id: productId },
        data: { status: 1 },
      });
    });

    return super.findAdminById(productId.toString());
  }

  override async delete(id: string): Promise<any> {
    const productId = parsePositiveBigIntId(id, '商品');
    const result = await this.productionPrisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: bigint }>>`
        SELECT id
        FROM products
        WHERE id = ${productId}
        FOR UPDATE
      `;
      if (locked.length === 0) throw new NotFoundException('商品不存在');

      const product = await tx.product.findUnique({
        where: { id: productId },
        include: {
          skus: true,
          productImages: true,
          category: true,
          brand: true,
          supplier: true,
        },
      });
      if (!product) throw new NotFoundException('商品不存在');
      if (product.deletedAt) return { product, replayed: true };
      if (product.status === 1) {
        throw new BadRequestException('上架商品无法删除，请先下架');
      }

      const deleted = await tx.product.update({
        where: { id: productId },
        data: { deletedAt: new Date() },
        include: {
          skus: true,
          productImages: true,
          category: true,
          brand: true,
          supplier: true,
        },
      });
      return { product: deleted, replayed: false };
    });

    // ProductService keeps its response serializer private; runtime access is intentional here and
    // mirrors the existing production publish validator bridge above so delete keeps the exact
    // established response shape while adding retry-safe locking.
    const serializeProduct = (this as any).serializeProduct;
    if (typeof serializeProduct !== 'function') {
      throw new Error('ProductService serializer is unavailable');
    }
    return serializeProduct.call(this, result.product);
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

  private createCreateRequestFingerprint(
    dto: CreateProductDto,
    categoryId: bigint,
    brandId: bigint | null,
    supplierId: bigint | null,
  ) {
    const semanticPayload = {
      name: dto.name,
      categoryId: categoryId.toString(),
      productType: dto.productType ?? 'physical',
      fulfillmentType: dto.fulfillmentType ?? 'delivery',
      businessCategory: dto.businessCategory ?? 'other',
      brandId: brandId?.toString() ?? null,
      supplierId: supplierId?.toString() ?? null,
      mainImage: dto.mainImage ?? null,
      videoUrl: dto.videoUrl ?? null,
      images: dto.images ?? null,
      description: dto.description ?? null,
      attributes: dto.attributes ?? null,
      servicePromise: dto.servicePromise ?? null,
      recommendAgeMin: dto.recommendAgeMin ?? null,
      recommendAgeMax: dto.recommendAgeMax ?? null,
      isPeriodPurchase: dto.isPeriodPurchase ?? 0,
      sortOrder: dto.sortOrder ?? 0,
      isRecommend: dto.isRecommend ?? 0,
      skus: dto.skus.map((sku) => ({
        skuCode: sku.skuCode?.trim() || null,
        specs: sku.specs ?? null,
        price: sku.price,
        originalPrice: sku.originalPrice ?? null,
        costPrice: sku.costPrice ?? null,
        stock: sku.stock ?? 0,
        image: sku.image ?? null,
        weight: sku.weight ?? null,
        barcode: sku.barcode ?? null,
      })),
    };
    return crypto
      .createHash('sha256')
      .update(this.stableStringify(semanticPayload))
      .digest('hex');
  }

  private stableStringify(value: unknown): string {
    if (value === undefined) return '"__undefined__"';
    if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
    }
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${this.stableStringify(record[key])}`)
      .join(',')}}`;
  }

  private readCreateEventPayload(payload: unknown): { productId: string; fingerprint: string } {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new BadRequestException('商品创建请求记录异常，请刷新商品列表后重试');
    }
    const record = payload as Record<string, unknown>;
    const productId = typeof record.productId === 'string' ? record.productId : '';
    const fingerprint = typeof record.fingerprint === 'string' ? record.fingerprint : '';
    if (!/^[1-9]\d*$/.test(productId) || !/^[a-f0-9]{64}$/.test(fingerprint)) {
      throw new BadRequestException('商品创建请求记录异常，请刷新商品列表后重试');
    }
    return { productId, fingerprint };
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
