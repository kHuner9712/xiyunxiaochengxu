import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AddCartDto } from './dto/add-cart.dto';
import { UpdateCartDto } from './dto/update-cart.dto';
import { CART_MAX_QUANTITY, CART_MAX_ITEMS } from '@baby-mall/shared';

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(userId: string) {
    const carts = await this.prisma.cart.findMany({
      where: { userId: BigInt(userId) },
      orderBy: { createdAt: 'desc' },
      include: {
        product: { select: { id: true, name: true, mainImage: true, status: true } },
        sku: { select: { id: true, specs: true, price: true, stock: true, status: true, image: true } },
      },
    });

    this.logger.log(`用户${userId}查询购物车，共${carts.length}条`);
    return carts.map((c) => ({
      ...c,
      id: c.id.toString(),
      userId: c.userId.toString(),
      productId: c.productId.toString(),
      skuId: c.skuId.toString(),
      product: c.product ? { ...c.product, id: c.product.id.toString() } : null,
      sku: c.sku ? { ...c.sku, id: c.sku.id.toString() } : null,
    }));
  }

  async addItem(userId: string, dto: AddCartDto) {
    const sku = await this.prisma.productSku.findFirst({
      where: { id: BigInt(dto.skuId), status: 1 },
      include: { product: true },
    });
    if (!sku) throw new NotFoundException('SKU不存在或已下架');
    if (sku.product.status !== 1) throw new BadRequestException('商品已下架');
    if (sku.stock < dto.quantity) throw new BadRequestException('库存不足');

    const cartCount = await this.prisma.cart.count({
      where: { userId: BigInt(userId) },
    });

    const existing = await this.prisma.cart.findFirst({
      where: { userId: BigInt(userId), skuId: BigInt(dto.skuId) },
    });

    if (existing) {
      const newQuantity = existing.quantity + dto.quantity;
      if (newQuantity > CART_MAX_QUANTITY) {
        throw new BadRequestException(`单件商品数量不能超过${CART_MAX_QUANTITY}`);
      }
      if (sku.stock < newQuantity) throw new BadRequestException('库存不足');

      const result = await this.prisma.cart.update({
        where: { id: existing.id },
        data: { quantity: newQuantity },
      });
      this.logger.log(`用户${userId}更新购物车SKU${dto.skuId}数量为${newQuantity}`);
      return { ...result, id: result.id.toString(), userId: result.userId.toString(), productId: result.productId.toString(), skuId: result.skuId.toString() };
    }

    if (cartCount >= CART_MAX_ITEMS) {
      throw new BadRequestException(`购物车最多添加${CART_MAX_ITEMS}种商品`);
    }

    const result = await this.prisma.cart.create({
      data: {
        userId: BigInt(userId),
        productId: sku.productId,
        skuId: BigInt(dto.skuId),
        quantity: dto.quantity,
      },
    });
    this.logger.log(`用户${userId}添加购物车SKU${dto.skuId}，数量${dto.quantity}`);
    return { ...result, id: result.id.toString(), userId: result.userId.toString(), productId: result.productId.toString(), skuId: result.skuId.toString() };
  }

  async updateItem(userId: string, dto: UpdateCartDto) {
    const cart = await this.prisma.cart.findFirst({
      where: { id: BigInt(dto.id), userId: BigInt(userId) },
    });
    if (!cart) throw new NotFoundException('购物车记录不存在');

    const updateData: any = {};
    if (dto.quantity !== undefined) {
      if (dto.quantity > CART_MAX_QUANTITY) {
        throw new BadRequestException(`单件商品数量不能超过${CART_MAX_QUANTITY}`);
      }
      const sku = await this.prisma.productSku.findFirst({
        where: { id: cart.skuId },
      });
      if (sku && sku.stock < dto.quantity) throw new BadRequestException('库存不足');
      updateData.quantity = dto.quantity;
    }
    if (dto.isSelected !== undefined) {
      updateData.isSelected = dto.isSelected;
    }

    const result = await this.prisma.cart.update({
      where: { id: BigInt(dto.id) },
      data: updateData,
    });
    this.logger.log(`用户${userId}更新购物车项${dto.id}`);
    return { ...result, id: result.id.toString(), userId: result.userId.toString(), productId: result.productId.toString(), skuId: result.skuId.toString() };
  }

  async removeItem(userId: string, id: string) {
    const cart = await this.prisma.cart.findFirst({
      where: { id: BigInt(id), userId: BigInt(userId) },
    });
    if (!cart) throw new NotFoundException('购物车记录不存在');

    const result = await this.prisma.cart.delete({ where: { id: BigInt(id) } });
    this.logger.log(`用户${userId}删除购物车项${id}`);
    return { ...result, id: result.id.toString(), userId: result.userId.toString(), productId: result.productId.toString(), skuId: result.skuId.toString() };
  }

  async selectAll(userId: string, isSelected: number) {
    await this.prisma.cart.updateMany({
      where: { userId: BigInt(userId) },
      data: { isSelected },
    });
    this.logger.log(`用户${userId}全选/取消全选购物车，isSelected=${isSelected}`);
  }

  async removeSelected(userId: string) {
    const result = await this.prisma.cart.deleteMany({
      where: { userId: BigInt(userId), isSelected: 1 },
    });
    this.logger.log(`用户${userId}删除已选购物车项，共${result.count}条`);
    return { deletedCount: result.count };
  }
}
