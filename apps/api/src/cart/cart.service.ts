import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { AddCartDto } from './dto/add-cart.dto';
import { UpdateCartDto } from './dto/update-cart.dto';
import { CART_MAX_QUANTITY, CART_MAX_ITEMS, formatSkuSpecs } from '@baby-mall/shared';
import { normalizeAssetUrl } from '../common/utils/asset-url';

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(userId: string) {
    const userIdValue = parsePositiveBigIntId(userId, '用户');
    const carts = await this.prisma.cart.findMany({
      where: { userId: userIdValue },
      orderBy: { createdAt: 'desc' },
      include: {
        product: { select: { id: true, name: true, mainImage: true, status: true } },
        sku: { select: { id: true, specs: true, price: true, stock: true, status: true, image: true } },
      },
    });

    this.logger.log(`用户${userId}查询购物车，共${carts.length}条`);
    return carts.map((c) => this.serializeCartItem(c));
  }

  async addItem(userId: string, dto: AddCartDto) {
    const userIdValue = parsePositiveBigIntId(userId, '用户');
    const skuId = parsePositiveBigIntId(dto.skuId, 'SKU ');
    const requestedProductId = dto.productId
      ? parsePositiveBigIntId(dto.productId, '商品')
      : null;
    if (!Number.isInteger(dto.quantity) || dto.quantity <= 0 || dto.quantity > CART_MAX_QUANTITY) {
      throw new BadRequestException(`单件商品数量必须为1-${CART_MAX_QUANTITY}`);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, userIdValue);
      const sku = await tx.productSku.findFirst({
        where: { id: skuId, status: 1 },
        include: { product: true },
      });
      if (!sku) throw new NotFoundException('SKU不存在或已下架');
      if (sku.product.status !== 1) throw new BadRequestException('商品已下架');
      if (requestedProductId && requestedProductId !== sku.productId) {
        throw new BadRequestException('SKU不属于所选商品');
      }

      const existing = await tx.cart.findFirst({
        where: { userId: userIdValue, skuId },
      });
      if (existing) {
        const newQuantity = existing.quantity + dto.quantity;
        if (newQuantity > CART_MAX_QUANTITY) {
          throw new BadRequestException(`单件商品数量不能超过${CART_MAX_QUANTITY}`);
        }
        if (sku.stock < newQuantity) throw new BadRequestException('库存不足');
        return tx.cart.update({
          where: { id: existing.id },
          data: { quantity: newQuantity },
        });
      }

      const cartCount = await tx.cart.count({ where: { userId: userIdValue } });
      if (cartCount >= CART_MAX_ITEMS) {
        throw new BadRequestException(`购物车最多添加${CART_MAX_ITEMS}种商品`);
      }
      if (sku.stock < dto.quantity) throw new BadRequestException('库存不足');

      return tx.cart.create({
        data: {
          userId: userIdValue,
          productId: sku.productId,
          skuId,
          quantity: dto.quantity,
        },
      });
    });

    this.logger.log(`用户${userId}添加/更新购物车SKU${dto.skuId}，数量${result.quantity}`);
    return this.serializeRawCart(result);
  }

  async updateItem(userId: string, dto: UpdateCartDto) {
    const userIdValue = parsePositiveBigIntId(userId, '用户');
    const cartId = parsePositiveBigIntId(dto.id, '购物车');
    const result = await this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, userIdValue);
      const cart = await tx.cart.findFirst({
        where: { id: cartId, userId: userIdValue },
        include: { sku: { include: { product: true } } },
      });
      if (!cart) throw new NotFoundException('购物车记录不存在');

      const updateData: Prisma.CartUpdateInput = {};
      if (dto.quantity !== undefined) {
        if (!Number.isInteger(dto.quantity) || dto.quantity <= 0 || dto.quantity > CART_MAX_QUANTITY) {
          throw new BadRequestException(`单件商品数量必须为1-${CART_MAX_QUANTITY}`);
        }
        if (cart.sku.status !== 1 || cart.sku.product.status !== 1) {
          throw new BadRequestException('商品或SKU已下架，不能修改购买数量');
        }
        if (cart.sku.stock < dto.quantity) throw new BadRequestException('库存不足');
        updateData.quantity = dto.quantity;
      }
      if (dto.isSelected !== undefined) {
        updateData.isSelected = dto.isSelected;
      }

      if (Object.keys(updateData).length === 0) return cart;
      return tx.cart.update({
        where: { id: cartId },
        data: updateData,
      });
    });
    this.logger.log(`用户${userId}更新购物车项${dto.id}`);
    return this.serializeRawCart(result);
  }

  async removeItem(userId: string, id: string) {
    const userIdValue = parsePositiveBigIntId(userId, '用户');
    const cartId = parsePositiveBigIntId(id, '购物车');
    const result = await this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, userIdValue);
      const cart = await tx.cart.findFirst({
        where: { id: cartId, userId: userIdValue },
      });
      if (!cart) throw new NotFoundException('购物车记录不存在');
      return tx.cart.delete({ where: { id: cartId } });
    });
    this.logger.log(`用户${userId}删除购物车项${id}`);
    return this.serializeRawCart(result);
  }

  async selectAll(userId: string, isSelected: number) {
    if (isSelected !== 0 && isSelected !== 1) {
      throw new BadRequestException('购物车选择状态无效');
    }
    const userIdValue = parsePositiveBigIntId(userId, '用户');
    const result = await this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, userIdValue);
      return tx.cart.updateMany({
        where: { userId: userIdValue },
        data: { isSelected },
      });
    });
    this.logger.log(`用户${userId}全选/取消全选购物车，isSelected=${isSelected}`);
    return { updatedCount: result.count };
  }

  async removeSelected(userId: string) {
    const userIdValue = parsePositiveBigIntId(userId, '用户');
    const result = await this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, userIdValue);
      return tx.cart.deleteMany({
        where: { userId: userIdValue, isSelected: 1 },
      });
    });
    this.logger.log(`用户${userId}删除已选购物车项，共${result.count}条`);
    return { deletedCount: result.count };
  }

  private async lockUser(tx: Prisma.TransactionClient, userId: bigint) {
    const rows = await tx.$queryRaw<Array<{ id: bigint }>>`
      SELECT id FROM users WHERE id = ${userId} AND deleted_at IS NULL FOR UPDATE
    `;
    if (rows.length === 0) throw new NotFoundException('用户不存在');
  }

  private serializeRawCart(result: any) {
    return {
      ...result,
      id: result.id.toString(),
      userId: result.userId.toString(),
      productId: result.productId.toString(),
      skuId: result.skuId.toString(),
    };
  }

  private serializeCartItem(cart: any) {
    const productValid = cart.product && cart.product.status === 1;
    const skuValid = cart.sku && cart.sku.status === 1;
    return {
      id: cart.id.toString(),
      userId: cart.userId.toString(),
      productId: cart.productId.toString(),
      skuId: cart.skuId.toString(),
      productName: cart.product?.name || '',
      productImage: normalizeAssetUrl(cart.sku?.image || cart.product?.mainImage || ''),
      skuName: formatSkuSpecs(cart.sku?.specs),
      price: cart.sku?.price || 0,
      originalPrice: cart.sku?.price || 0,
      quantity: cart.quantity,
      stock: cart.sku?.stock || 0,
      isSelected: cart.isSelected === 1,
      isValid: productValid && skuValid,
      product: cart.product ? { ...cart.product, id: cart.product.id.toString() } : null,
      sku: cart.sku ? { ...cart.sku, id: cart.sku.id.toString() } : null,
    };
  }
}