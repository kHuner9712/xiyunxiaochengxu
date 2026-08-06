import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import {
  FREIGHT_DEFAULT_FEE,
  FREIGHT_FREE_AMOUNT,
  FREIGHT_REMOTE_AREAS,
  FREIGHT_REMOTE_FEE,
  generateOrderNo,
  generatePaymentNo,
} from '@baby-mall/shared';
import { PAYMENT_STATUS } from '../common/constants/payment';
import { normalizeAssetUrl } from '../common/utils/asset-url';

const DEFAULT_COVER_MARKER = '/uploads/static/default-cover.png';
const PROMOTION_ACTIVITY_TYPES = new Set(['flash_sale', 'group_buy']);
const ALLOWED_SOURCE_TYPES = new Set([
  'direct',
  'user_referral',
  'merchant_referral',
  'campaign',
]);

type TransactionClient = Prisma.TransactionClient;

export interface PromotionCheckoutInput {
  userId: bigint;
  skuId: bigint;
  quantity: number;
  unitPrice: number;
  activityId: bigint;
  activityType: 'flash_sale' | 'group_buy';
  addressId?: string;
  pickupStoreId?: string;
  fulfillmentType?: string;
  sourceType?: string;
  sourceCode?: string;
  referrerUserId?: string;
  remark?: string;
}

export interface PromotionCheckoutResult {
  orderId: bigint;
  orderItemId: bigint;
  orderNo: string;
  payAmount: number;
  isZeroPay: boolean;
  status: OrderStatus;
  fulfillmentType: string;
}

function pickOrderProductImage(
  skuImage?: string | null,
  productMainImage?: string | null,
): string {
  const cleanSkuImage = typeof skuImage === 'string' ? skuImage.trim() : '';
  const cleanProductMainImage =
    typeof productMainImage === 'string' ? productMainImage.trim() : '';
  const candidate =
    cleanSkuImage && !cleanSkuImage.includes(DEFAULT_COVER_MARKER)
      ? cleanSkuImage
      : cleanProductMainImage;
  return normalizeAssetUrl(candidate || '');
}

@Injectable()
export class PromotionCheckoutService {
  assertNoUnsupportedStacking(input: {
    couponId?: string;
    pointsDeduct?: number;
  }): void {
    if (input.couponId) {
      throw new BadRequestException('促销订单暂不支持叠加优惠券');
    }
    if ((input.pointsDeduct ?? 0) > 0) {
      throw new BadRequestException('促销订单暂不支持叠加积分抵扣');
    }
  }

  async createOrder(
    tx: TransactionClient,
    input: PromotionCheckoutInput,
  ): Promise<PromotionCheckoutResult> {
    if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
      throw new BadRequestException('购买数量必须为正整数');
    }
    if (!Number.isSafeInteger(input.unitPrice) || input.unitPrice < 0) {
      throw new BadRequestException('活动价格无效');
    }
    if (!PROMOTION_ACTIVITY_TYPES.has(input.activityType)) {
      throw new BadRequestException('活动类型无效');
    }

    const fulfillmentType = input.fulfillmentType || 'delivery';
    if (fulfillmentType !== 'delivery' && fulfillmentType !== 'pickup') {
      throw new BadRequestException('履约方式无效');
    }
    if (fulfillmentType === 'delivery' && !input.addressId) {
      throw new BadRequestException('快递配送必须选择收货地址');
    }
    if (fulfillmentType === 'pickup' && !input.pickupStoreId) {
      throw new BadRequestException('到店自提必须选择自提点');
    }

    const [address, pickupStore, sku] = await Promise.all([
      fulfillmentType === 'delivery'
        ? tx.userAddress.findFirst({
            where: {
              id: BigInt(input.addressId!),
              userId: input.userId,
              deletedAt: null,
            },
          })
        : null,
      fulfillmentType === 'pickup'
        ? tx.pickupStore.findFirst({
            where: {
              id: BigInt(input.pickupStoreId!),
              status: 1,
              deletedAt: null,
            },
          })
        : null,
      tx.productSku.findFirst({
        where: { id: input.skuId, status: 1 },
        include: { product: true },
      }),
    ]);

    if (fulfillmentType === 'delivery' && !address) {
      throw new NotFoundException('收货地址不存在');
    }
    if (fulfillmentType === 'pickup' && !pickupStore) {
      throw new NotFoundException('自提点不存在或已停用');
    }
    if (!sku || sku.product.status !== 1) {
      throw new NotFoundException('活动商品规格不存在或已下架');
    }
    if (input.unitPrice > sku.price) {
      throw new BadRequestException('活动价格不能高于商品原价');
    }

    const stockClaim = await tx.productSku.updateMany({
      where: { id: sku.id, status: 1, stock: { gte: input.quantity } },
      data: {
        stock: { decrement: input.quantity },
        sales: { increment: input.quantity },
      },
    });
    if (stockClaim.count === 0) {
      throw new BadRequestException('库存不足，下单失败');
    }

    const skuAfterDeduct = await tx.productSku.findUnique({
      where: { id: sku.id },
      select: { stock: true },
    });
    if (!skuAfterDeduct) {
      throw new BadRequestException('SKU不存在，下单失败');
    }
    await tx.productStockLog.create({
      data: {
        productId: sku.productId,
        skuId: sku.id,
        type: 1,
        quantity: input.quantity,
        beforeStock: skuAfterDeduct.stock + input.quantity,
        afterStock: skuAfterDeduct.stock,
        reason: `${input.activityType === 'flash_sale' ? '秒杀' : '拼团'}订单预扣库存`,
      },
    });

    const totalAmount = sku.price * input.quantity;
    const promotionSubtotal = input.unitPrice * input.quantity;
    const activityDiscountAmount = totalAmount - promotionSubtotal;
    const freightAmount =
      fulfillmentType === 'delivery'
        ? this.calculateFreight(totalAmount, address?.province)
        : 0;
    const payAmount = Math.max(
      0,
      totalAmount - activityDiscountAmount + freightAmount,
    );
    const isZeroPay = payAmount === 0;
    const status = isZeroPay
      ? fulfillmentType === 'pickup'
        ? OrderStatus.pending_pickup
        : OrderStatus.pending_delivery
      : OrderStatus.pending_payment;

    const sourceType =
      input.sourceType && ALLOWED_SOURCE_TYPES.has(input.sourceType)
        ? input.sourceType
        : 'direct';
    const sourceCode = input.sourceCode?.trim() || null;
    const referrerUserId = input.referrerUserId
      ? BigInt(input.referrerUserId)
      : null;
    const pickupCode =
      isZeroPay && fulfillmentType === 'pickup'
        ? await this.generatePickupCode(tx)
        : null;

    const order = await tx.order.create({
      data: {
        orderNo: generateOrderNo(),
        userId: input.userId,
        status,
        totalAmount,
        discountAmount: 0,
        freightAmount,
        pointsAmount: 0,
        payAmount,
        pointsDeducted: 0,
        couponId: null,
        couponAmount: 0,
        activityDiscountAmount,
        fulfillmentType,
        sourceType,
        sourceCode,
        referrerUserId,
        receiverName: address?.receiverName ?? '',
        receiverPhone: address?.receiverPhone ?? '',
        province: address?.province ?? null,
        city: address?.city ?? null,
        district: address?.district ?? null,
        detailAddress: address?.detailAddress ?? null,
        pickupStoreId: pickupStore?.id ?? null,
        pickupStoreName: pickupStore?.name ?? null,
        pickupStoreAddress: pickupStore
          ? `${pickupStore.province}${pickupStore.city}${pickupStore.district}${pickupStore.address}`
          : null,
        pickupContactPhone: pickupStore?.contactPhone ?? null,
        pickupCode,
        remark: input.remark,
        ...(isZeroPay
          ? { paidAt: new Date() }
          : { autoCloseAt: new Date(Date.now() + 30 * 60 * 1000) }),
        orderItems: {
          create: {
            productId: sku.productId,
            skuId: sku.id,
            productName: sku.product.name,
            skuSpecs:
              sku.specs === null
                ? Prisma.JsonNull
                : (sku.specs as Prisma.InputJsonValue),
            productImage: pickOrderProductImage(
              sku.image,
              sku.product.mainImage,
            ),
            price: input.unitPrice,
            originalPrice: sku.price,
            quantity: input.quantity,
            subtotal: promotionSubtotal,
            activityId: input.activityId,
            activityType: input.activityType,
            activityDiscount: activityDiscountAmount,
            supplierId: sku.product.supplierId,
          },
        },
        orderLogs: {
          create: {
            operatorType: 'user',
            operatorId: input.userId,
            action: 'create',
            content: `${input.activityType === 'flash_sale' ? '秒杀' : '拼团'}下单`,
          },
        },
      },
      include: { orderItems: true },
    });

    const orderItem = order.orderItems[0];
    if (!orderItem) {
      throw new InternalServerErrorException('促销订单项创建失败');
    }

    let paymentCreated = false;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await tx.orderPayment.create({
          data: {
            orderId: order.id,
            paymentNo: generatePaymentNo(),
            amount: payAmount,
            paymentMethod: isZeroPay ? 'zero_pay' : 'wechat',
            status: isZeroPay
              ? PAYMENT_STATUS.SUCCESS
              : PAYMENT_STATUS.CREATED,
            ...(isZeroPay ? { paidAt: new Date() } : {}),
          },
        });
        paymentCreated = true;
        break;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          continue;
        }
        throw error;
      }
    }
    if (!paymentCreated) {
      throw new InternalServerErrorException('支付单号生成失败，请重试');
    }

    if (isZeroPay) {
      await tx.orderLog.create({
        data: {
          orderId: order.id,
          operatorType: 'system',
          action: 'pay_zero_amount',
          content: '0元促销订单自动支付成功',
        },
      });
    }

    await tx.cart.deleteMany({
      where: { userId: input.userId, skuId: input.skuId },
    });

    return {
      orderId: order.id,
      orderItemId: orderItem.id,
      orderNo: order.orderNo,
      payAmount,
      isZeroPay,
      status,
      fulfillmentType,
    };
  }

  private calculateFreight(totalAmount: number, province?: string): number {
    if (totalAmount >= FREIGHT_FREE_AMOUNT) return 0;
    if (
      province &&
      FREIGHT_REMOTE_AREAS.some((area) => province.includes(area))
    ) {
      return FREIGHT_REMOTE_FEE;
    }
    return FREIGHT_DEFAULT_FEE;
  }

  private async generatePickupCode(tx: TransactionClient): Promise<string> {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const code = String(crypto.randomInt(10000000, 100000000));
      const exists = await tx.order.findFirst({
        where: { pickupCode: code },
        select: { id: true },
      });
      if (!exists) return code;
    }
    throw new InternalServerErrorException('自提码生成失败，请重试');
  }
}
