import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { AddCartDto } from './dto/add-cart.dto';
import { UpdateCartDto } from './dto/update-cart.dto';
import { CART_MAX_QUANTITY, CART_MAX_ITEMS, formatSkuSpecs } from '@baby-mall/shared';
import { normalizeAssetUrl } from '../common/utils/asset-url';

const CART_ADD_EVENT = 'cart_add';
const CART_REMOVE_EVENT = 'cart_remove';

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
    const requestId = dto.clientRequestId?.trim() || null;
    const requestBizType = `cart:${userIdValue.toString()}`;
    const requestFingerprint = JSON.stringify({
      productId: requestedProductId?.toString() || '',
      skuId: skuId.toString(),
      quantity: dto.quantity,
    });

    const result = await this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, userIdValue);

      // This is an incremental mutation. Check the durable request fact before looking at current
      // quantity/stock so a response-loss retry cannot increment again or be rejected by a limit
      // that the first successful attempt itself reached.
      if (requestId) {
        const handled = await tx.businessEvent.findFirst({
          where: {
            eventType: CART_ADD_EVENT,
            bizType: requestBizType,
            bizId: requestId,
          },
          orderBy: { id: 'desc' },
        });
        if (handled) {
          const eventPayload = this.readAddEventPayload(handled.payload);
          if (eventPayload.fingerprint !== requestFingerprint) {
            throw new BadRequestException('加购请求ID已被其他操作使用，请重新操作');
          }
          const cartId = parsePositiveBigIntId(eventPayload.cartId, '购物车');
          const replayCart = await tx.cart.findFirst({
            where: { id: cartId, userId: userIdValue },
          });
          if (!replayCart) {
            throw new BadRequestException('该加购请求已处理，请刷新购物车后重新操作');
          }
          return { cart: replayCart, replayed: true };
        }
      }

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
      let cart: any;
      if (existing) {
        const newQuantity = existing.quantity + dto.quantity;
        if (newQuantity > CART_MAX_QUANTITY) {
          throw new BadRequestException(`单件商品数量不能超过${CART_MAX_QUANTITY}`);
        }
        if (sku.stock < newQuantity) throw new BadRequestException('库存不足');
        cart = await tx.cart.update({
          where: { id: existing.id },
          data: { quantity: newQuantity },
        });
      } else {
        const cartCount = await tx.cart.count({ where: { userId: userIdValue } });
        if (cartCount >= CART_MAX_ITEMS) {
          throw new BadRequestException(`购物车最多添加${CART_MAX_ITEMS}种商品`);
        }
        if (sku.stock < dto.quantity) throw new BadRequestException('库存不足');

        cart = await tx.cart.create({
          data: {
            userId: userIdValue,
            productId: sku.productId,
            skuId,
            quantity: dto.quantity,
          },
        });
      }

      if (requestId) {
        // User-row locking serializes all cart mutations for this account. Persisting the operation
        // marker in the same transaction makes retries crash-safe without a schema migration.
        await tx.businessEvent.create({
          data: {
            eventType: CART_ADD_EVENT,
            bizType: requestBizType,
            bizId: requestId,
            level: 'info',
            message: '购物车加购请求已处理',
            payload: {
              cartId: cart.id.toString(),
              fingerprint: requestFingerprint,
            },
          },
        });
      }

      return { cart, replayed: false };
    });

    this.logger.log(
      `用户${userId}添加/更新购物车SKU${dto.skuId}，数量${result.cart.quantity}${result.replayed ? '（幂等重放）' : ''}`,
    );
    return this.serializeRawCart(result.cart);
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

      const nextQuantity = dto.quantity ?? cart.quantity;
      const wantsSelection = dto.isSelected === 1;
      if (dto.quantity !== undefined || wantsSelection) {
        if (!Number.isInteger(nextQuantity) || nextQuantity <= 0 || nextQuantity > CART_MAX_QUANTITY) {
          throw new BadRequestException(`单件商品数量必须为1-${CART_MAX_QUANTITY}`);
        }
        if (cart.sku.status !== 1 || cart.sku.product.status !== 1) {
          throw new BadRequestException('商品或SKU已下架，不能选中购买');
        }
        if (cart.sku.stock < nextQuantity) throw new BadRequestException('库存不足');
      }

      const updateData: Prisma.CartUpdateInput = {};
      if (dto.quantity !== undefined) updateData.quantity = dto.quantity;
      if (dto.isSelected !== undefined) updateData.isSelected = dto.isSelected;

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
    const requestBizType = `cart:${userIdValue.toString()}`;
    const requestBizId = cartId.toString();

    const result = await this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, userIdValue);

      // Cart rows are hard-deleted, so the row itself cannot prove that a response-loss retry belongs
      // to this user. Persist the cart id as the durable deletion fact. Unknown/foreign ids have no
      // such fact and still fail closed instead of being treated as a successful delete.
      const handled = await tx.businessEvent.findFirst({
        where: {
          eventType: CART_REMOVE_EVENT,
          bizType: requestBizType,
          bizId: requestBizId,
        },
        orderBy: { id: 'desc' },
      });
      if (handled) {
        return { cart: this.readRemoveEventPayload(handled.payload), replayed: true };
      }

      const cart = await tx.cart.findFirst({
        where: { id: cartId, userId: userIdValue },
      });
      if (!cart) throw new NotFoundException('购物车记录不存在');

      const deleted = await tx.cart.delete({ where: { id: cartId } });
      const serialized = this.serializeRawCart(deleted);
      await tx.businessEvent.create({
        data: {
          eventType: CART_REMOVE_EVENT,
          bizType: requestBizType,
          bizId: requestBizId,
          level: 'info',
          message: '购物车删除请求已处理',
          payload: { cart: serialized },
        },
      });
      return { cart: serialized, replayed: false };
    });

    this.logger.log(`用户${userId}删除购物车项${id}${result.replayed ? '（幂等重放）' : ''}`);
    return result.cart;
  }

  async selectAll(userId: string, isSelected: number) {
    if (isSelected !== 0 && isSelected !== 1) {
      throw new BadRequestException('购物车选择状态无效');
    }
    const userIdValue = parsePositiveBigIntId(userId, '用户');
    const result = await this.prisma.$transaction(async (tx) => {
      await this.lockUser(tx, userIdValue);
      if (isSelected === 0) {
        return tx.cart.updateMany({
          where: { userId: userIdValue },
          data: { isSelected: 0 },
        });
      }

      // Clear stale selections first, then only select rows that are still purchasable at their
      // current quantity. This makes the API itself safe even if a client ignores `isValid`.
      await tx.cart.updateMany({
        where: { userId: userIdValue },
        data: { isSelected: 0 },
      });
      const carts = await tx.cart.findMany({
        where: { userId: userIdValue },
        include: {
          product: { select: { status: true } },
          sku: { select: { status: true, stock: true } },
        },
      });
      const validIds = carts
        .filter((cart) =>
          cart.product?.status === 1 &&
          cart.sku?.status === 1 &&
          cart.quantity > 0 &&
          cart.sku.stock >= cart.quantity,
        )
        .map((cart) => cart.id);
      if (validIds.length === 0) return { count: 0 };
      return tx.cart.updateMany({
        where: { userId: userIdValue, id: { in: validIds } },
        data: { isSelected: 1 },
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

  private readAddEventPayload(payload: unknown): { cartId: string; fingerprint: string } {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new BadRequestException('加购请求记录异常，请刷新购物车后重试');
    }
    const record = payload as Record<string, unknown>;
    const cartId = typeof record.cartId === 'string' ? record.cartId : '';
    const fingerprint = typeof record.fingerprint === 'string' ? record.fingerprint : '';
    if (!cartId || !fingerprint) {
      throw new BadRequestException('加购请求记录异常，请刷新购物车后重试');
    }
    return { cartId, fingerprint };
  }

  private readRemoveEventPayload(payload: unknown) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new BadRequestException('购物车删除请求记录异常，请刷新购物车后重试');
    }
    const cart = (payload as Record<string, unknown>).cart;
    if (!cart || typeof cart !== 'object' || Array.isArray(cart)) {
      throw new BadRequestException('购物车删除请求记录异常，请刷新购物车后重试');
    }
    const record = cart as Record<string, unknown>;
    for (const key of ['id', 'userId', 'productId', 'skuId']) {
      if (typeof record[key] !== 'string' || !record[key]) {
        throw new BadRequestException('购物车删除请求记录异常，请刷新购物车后重试');
      }
    }
    return record;
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
    const stockValid = skuValid && Number.isInteger(cart.quantity) && cart.quantity > 0 && cart.sku.stock >= cart.quantity;
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
      isValid: productValid && skuValid && stockValid,
      product: cart.product ? { ...cart.product, id: cart.product.id.toString() } : null,
      sku: cart.sku ? { ...cart.sku, id: cart.sku.id.toString() } : null,
    };
  }
}