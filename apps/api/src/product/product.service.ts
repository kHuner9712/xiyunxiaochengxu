import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ProductQueryDto } from './dto/product-query.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { paginate } from '@baby-mall/shared';

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  constructor(private prisma: PrismaService) {}

  async findPublished(dto: ProductQueryDto) {
    const where: any = { status: 1, deletedAt: null };
    if (dto.categoryId) where.categoryId = BigInt(dto.categoryId);
    if (dto.brandId) where.brandId = BigInt(dto.brandId);
    if (dto.keyword) where.name = { contains: dto.keyword };
    if (dto.isRecommend !== undefined) where.isRecommend = dto.isRecommend;

    const [list, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip: dto.skip,
        take: dto.take,
        orderBy: { sortOrder: 'asc' },
        include: {
          skus: { where: { status: 1 } },
          category: true,
          brand: true,
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    this.logger.log(`查询上架商品列表，共${total}条`);
    return paginate(list.map((p) => this.serializeProduct(p)), total, dto.page, dto.pageSize);
  }

  async findById(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: BigInt(id), deletedAt: null },
      include: {
        skus: { where: { status: 1 } },
        productImages: { orderBy: { sortOrder: 'asc' } },
        category: true,
        brand: true,
        supplier: true,
      },
    });
    if (!product) throw new NotFoundException('商品不存在');

    this.logger.log(`查询商品详情：${id}`);
    return this.serializeProduct(product);
  }

  async findRecommend(dto: ProductQueryDto) {
    const where: any = { status: 1, deletedAt: null, isRecommend: 1 };
    if (dto.categoryId) where.categoryId = BigInt(dto.categoryId);

    const [list, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip: dto.skip,
        take: dto.take,
        orderBy: { sortOrder: 'asc' },
        include: { skus: { where: { status: 1 } } },
      }),
      this.prisma.product.count({ where }),
    ]);

    this.logger.log(`查询推荐商品列表，共${total}条`);
    return paginate(list.map((p) => this.serializeProduct(p)), total, dto.page, dto.pageSize);
  }

  async findAllAdmin(dto: ProductQueryDto) {
    const where: any = { deletedAt: null };
    if (dto.categoryId) where.categoryId = BigInt(dto.categoryId);
    if (dto.brandId) where.brandId = BigInt(dto.brandId);
    if (dto.supplierId) where.supplierId = BigInt(dto.supplierId);
    if (dto.keyword) where.name = { contains: dto.keyword };
    if (dto.status !== undefined) where.status = dto.status;
    if (dto.isRecommend !== undefined) where.isRecommend = dto.isRecommend;

    const [list, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip: dto.skip,
        take: dto.take,
        orderBy: { createdAt: 'desc' },
        include: { category: true, brand: true, supplier: true, skus: true },
      }),
      this.prisma.product.count({ where }),
    ]);

    this.logger.log(`管理员查询商品列表，共${total}条`);
    return paginate(list.map((p) => this.serializeProduct(p)), total, dto.page, dto.pageSize);
  }

  async findAdminById(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: BigInt(id), deletedAt: null },
      include: {
        skus: true,
        productImages: { orderBy: { sortOrder: 'asc' } },
        category: true,
        brand: true,
        supplier: true,
      },
    });
    if (!product) throw new NotFoundException('商品不存在');
    return this.serializeProduct(product);
  }

  async create(dto: CreateProductDto) {
    const result = await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          name: dto.name,
          categoryId: BigInt(dto.categoryId),
          brandId: dto.brandId ? BigInt(dto.brandId) : null,
          supplierId: dto.supplierId ? BigInt(dto.supplierId) : null,
          mainImage: dto.mainImage,
          images: dto.images,
          description: dto.description,
          attributes: dto.attributes,
          servicePromise: dto.servicePromise,
          recommendAgeMin: dto.recommendAgeMin,
          recommendAgeMax: dto.recommendAgeMax,
          isPeriodPurchase: dto.isPeriodPurchase ?? 0,
          status: 3,
          skus: {
            create: dto.skus.map((sku) => ({
              skuCode: sku.skuCode,
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

      const prices = product.skus.map((s) => s.price);
      if (prices.length > 0) {
        await tx.product.update({
          where: { id: product.id },
          data: {
            minPrice: Math.min(...prices),
            maxPrice: Math.max(...prices),
          },
        });
      }

      return product;
    });

    this.logger.log(`创建商品：${result.id}`);
    return this.serializeProduct(result);
  }

  async update(id: string, dto: UpdateProductDto) {
    const product = await this.prisma.product.findFirst({
      where: { id: BigInt(id), deletedAt: null },
    });
    if (!product) throw new NotFoundException('商品不存在');

    const result = await this.prisma.$transaction(async (tx) => {
      const updateData: any = {};
      if (dto.name !== undefined) updateData.name = dto.name;
      if (dto.categoryId !== undefined) updateData.categoryId = BigInt(dto.categoryId);
      if (dto.brandId !== undefined) updateData.brandId = dto.brandId ? BigInt(dto.brandId) : null;
      if (dto.supplierId !== undefined) updateData.supplierId = dto.supplierId ? BigInt(dto.supplierId) : null;
      if (dto.mainImage !== undefined) updateData.mainImage = dto.mainImage;
      if (dto.images !== undefined) updateData.images = dto.images;
      if (dto.description !== undefined) updateData.description = dto.description;
      if (dto.attributes !== undefined) updateData.attributes = dto.attributes;
      if (dto.servicePromise !== undefined) updateData.servicePromise = dto.servicePromise;
      if (dto.recommendAgeMin !== undefined) updateData.recommendAgeMin = dto.recommendAgeMin;
      if (dto.recommendAgeMax !== undefined) updateData.recommendAgeMax = dto.recommendAgeMax;
      if (dto.isPeriodPurchase !== undefined) updateData.isPeriodPurchase = dto.isPeriodPurchase;

      if (dto.skus && dto.skus.length > 0) {
        await tx.productSku.updateMany({
          where: { productId: BigInt(id) },
          data: { status: 2 },
        });

        for (const sku of dto.skus) {
          await tx.productSku.create({
            data: {
              productId: BigInt(id),
              skuCode: sku.skuCode,
              specs: sku.specs,
              price: sku.price,
              originalPrice: sku.originalPrice,
              costPrice: sku.costPrice,
              stock: sku.stock ?? 0,
              image: sku.image,
              weight: sku.weight,
              barcode: sku.barcode,
            },
          });
        }

        const newSkus = await tx.productSku.findMany({
          where: { productId: BigInt(id), status: 1 },
        });
        const prices = newSkus.map((s) => s.price);
        if (prices.length > 0) {
          updateData.minPrice = Math.min(...prices);
          updateData.maxPrice = Math.max(...prices);
        }
      }

      return tx.product.update({
        where: { id: BigInt(id) },
        data: updateData,
        include: { skus: { where: { status: 1 } } },
      });
    });

    this.logger.log(`更新商品：${id}`);
    return this.serializeProduct(result);
  }

  async updateStatus(id: string, status: number) {
    const product = await this.prisma.product.findFirst({
      where: { id: BigInt(id), deletedAt: null },
    });
    if (!product) throw new NotFoundException('商品不存在');

    if (status === 1 && product.minPrice === null) {
      throw new BadRequestException('商品无有效SKU，无法上架');
    }

    const result = await this.prisma.product.update({
      where: { id: BigInt(id) },
      data: { status },
    });

    this.logger.log(`更新商品状态：${id} -> ${status}`);
    return this.serializeProduct(result);
  }

  async delete(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: BigInt(id), deletedAt: null },
    });
    if (!product) throw new NotFoundException('商品不存在');

    if (product.status === 1) {
      throw new BadRequestException('上架商品无法删除，请先下架');
    }

    const result = await this.prisma.product.update({
      where: { id: BigInt(id) },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`删除商品：${id}`);
    return this.serializeProduct(result);
  }

  private serializeProduct(product: any) {
    return {
      ...product,
      id: product.id.toString(),
      categoryId: product.categoryId?.toString(),
      brandId: product.brandId?.toString(),
      supplierId: product.supplierId?.toString(),
      compliance: product.attributes?.compliance || null,
      skus: product.skus?.map((s: any) => ({
        ...s,
        id: s.id.toString(),
        productId: s.productId.toString(),
      })),
      productImages: product.productImages?.map((img: any) => ({
        ...img,
        id: img.id.toString(),
        productId: img.productId.toString(),
      })),
      category: product.category
        ? { ...product.category, id: product.category.id.toString() }
        : null,
      brand: product.brand
        ? { ...product.brand, id: product.brand.id.toString() }
        : null,
      supplier: product.supplier
        ? { ...product.supplier, id: product.supplier.id.toString() }
        : null,
    };
  }
}
