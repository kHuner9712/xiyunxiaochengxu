import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException, Logger, Inject, forwardRef } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../common/prisma/prisma.service';
import { OrderQueryDto } from './dto/order-query.dto';
import { DeliverDto, BatchDeliverDto } from './dto/deliver.dto';
import { generateOrderNo, generatePaymentNo, paginate } from '@baby-mall/shared';
import {
  OrderStatus,
  AftersaleStatus,
} from '@prisma/client';
import {
  FREIGHT_FREE_AMOUNT,
  FREIGHT_DEFAULT_FEE,
  FREIGHT_REMOTE_FEE,
  FREIGHT_REMOTE_AREAS,
  POINTS_DEDUCT_RATE,
  POINTS_DEDUCT_MAX_PERCENT,
  ORDER_AUTO_CLOSE_MINUTES,
  ORDER_AUTO_COMPLETE_DAYS,
  formatSkuSpecs,
} from '@baby-mall/shared';
import { assertOrderTransition } from './order-state-machine';
import { COUPON_STATUS, PAYMENT_STATUS } from '../common/constants/payment';
import { BusinessEventService } from '../common/business-event.service';
import { normalizeAssetUrl } from '../common/utils/asset-url';
import { BenefitPackageService } from '../benefit-package/benefit-package.service';
import { GroupBuyService } from '../group-buy/group-buy.service';

const DEFAULT_COVER_MARKER = '/uploads/static/default-cover.png';

function pickOrderProductImage(skuImage?: string | null, productMainImage?: string | null): string {
  const cleanSkuImage = typeof skuImage === 'string' ? skuImage.trim() : '';
  const cleanProductMainImage = typeof productMainImage === 'string' ? productMainImage.trim() : '';

  const candidate =
    cleanSkuImage && !cleanSkuImage.includes(DEFAULT_COVER_MARKER)
      ? cleanSkuImage
      : cleanProductMainImage;

  return normalizeAssetUrl(candidate || '');
}

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private prisma: PrismaService,
    private businessEvent: BusinessEventService,
    private benefitPackageService: BenefitPackageService,
    @Inject(forwardRef(() => GroupBuyService))
    private groupBuyService: GroupBuyService,
  ) {}

  async getOrderCountByUser(userId: string) {
    const where = { userId: BigInt(userId) };

    const [unpaid, unshipped, pendingPickup, unreceived, aftersale] = await Promise.all([
      this.prisma.order.count({ where: { ...where, status: OrderStatus.pending_payment } }),
      this.prisma.order.count({ where: { ...where, status: OrderStatus.pending_delivery } }),
      this.prisma.order.count({ where: { ...where, status: OrderStatus.pending_pickup } }),
      this.prisma.order.count({ where: { ...where, status: OrderStatus.delivered } }),
      this.prisma.order.count({ where: { ...where, status: OrderStatus.aftersale } }),
    ]);

    return { unpaid, unshipped, pendingPickup, unreceived, aftersale };
  }

  async confirm(userId: string, data: { items: { skuId: string; quantity: number }[]; addressId?: string; pickupStoreId?: string; fulfillmentType?: string; couponId?: string; pointsDeduct?: number }) {
    const fulfillmentType = data.fulfillmentType || 'delivery';

    if (fulfillmentType === 'delivery' && !data.addressId) {
      throw new BadRequestException('快递配送必须选择收货地址');
    }
    if (fulfillmentType === 'pickup' && !data.pickupStoreId) {
      throw new BadRequestException('到店自提必须选择自提点');
    }

    let totalAmount = 0;
    let discountAmount = 0;
    let couponAmount = 0;
    let activityDiscountAmount = 0;
    const confirmItems: any[] = [];

    for (const item of data.items) {
      const sku = await this.prisma.productSku.findFirst({
        where: { id: BigInt(item.skuId), status: 1 },
        include: { product: true },
      });
      if (!sku) throw new NotFoundException(`SKU ${item.skuId} 不存在或已下架`);
      if (sku.product.status !== 1) throw new BadRequestException(`商品 ${sku.product.name} 已下架`);
      if (sku.stock < item.quantity) {
        this.businessEvent.emitWarn('stock_insufficient', 'stock', `库存不足: 商品${sku.product.name} SKU ${item.skuId}`, item.skuId.toString(), { skuId: item.skuId.toString(), stock: sku.stock, requested: item.quantity });
        throw new BadRequestException(`商品 ${sku.product.name} 库存不足`);
      }

      const subtotal = sku.price * item.quantity;
      totalAmount += subtotal;

      confirmItems.push({
        productId: sku.productId.toString(),
        skuId: sku.id.toString(),
        productName: sku.product.name,
        skuSpecs: sku.specs,
        skuSpecText: formatSkuSpecs(sku.specs),
        productImage: pickOrderProductImage(sku.image, sku.product.mainImage),
        price: sku.price,
        originalPrice: sku.originalPrice,
        quantity: item.quantity,
        subtotal,
      });
    }

    if (data.couponId) {
      const userCoupon = await this.prisma.userCoupon.findFirst({
        where: {
          id: BigInt(data.couponId),
          userId: BigInt(userId),
          status: COUPON_STATUS.FREE,
        },
        include: { coupon: true },
      });
      if (!userCoupon) throw new BadRequestException('优惠券不可用');
      if (!userCoupon.expireAt || new Date() > userCoupon.expireAt) throw new BadRequestException('优惠券已过期');
      if (totalAmount < userCoupon.coupon.minAmount) throw new BadRequestException('未达到优惠券使用门槛');

      couponAmount = this.calculateCouponAmount(userCoupon.coupon, totalAmount);
    }

    const user = await this.prisma.user.findFirst({
      where: { id: BigInt(userId) },
    });
    if ((data.pointsDeduct || 0) > 0 && !user) throw new NotFoundException('用户不存在');
    const pointsBaseAmount = Math.max(0, totalAmount - discountAmount - activityDiscountAmount);
    const pointsDeduction = this.calculatePointsDeduction(pointsBaseAmount, user?.availablePoints || 0, data.pointsDeduct || 0);
    const pointsAmount = pointsDeduction.pointsAmount;

    let freightAmount = 0;
    if (fulfillmentType === 'delivery') {
      if (data.addressId) {
        const address = await this.prisma.userAddress.findFirst({
          where: { id: BigInt(data.addressId), userId: BigInt(userId), deletedAt: null },
        });
        if (address) {
          freightAmount = this.calculateFreight(totalAmount, address.province);
        }
      } else {
        freightAmount = this.calculateFreight(totalAmount);
      }
    }

    const payAmount = this.calculatePayAmount({
      totalAmount,
      discountAmount,
      couponAmount,
      activityDiscountAmount,
      pointsAmount,
      freightAmount,
    });

    this.logger.log(`用户${userId}确认订单金额：商品${totalAmount}分，优惠${discountAmount + couponAmount + activityDiscountAmount}分，积分抵扣${pointsAmount}分，运费${freightAmount}分，实付${payAmount}分`);

    return {
      items: confirmItems,
      totalAmount,
      discountAmount,
      couponAmount,
      activityDiscountAmount,
      pointsAmount,
      pointsDeducted: pointsDeduction.pointsDeducted,
      availablePoints: pointsDeduction.availablePoints,
      maxPointsDeduct: pointsDeduction.maxPointsDeduct,
      pointsDeductRate: POINTS_DEDUCT_RATE,
      pointsDeductMaxPercent: POINTS_DEDUCT_MAX_PERCENT,
      freightAmount,
      payAmount,
      fulfillmentType,
      isZeroPay: payAmount === 0,
      pickupStore: fulfillmentType === 'pickup' && data.pickupStoreId ? await this.getPickupStoreInfo(data.pickupStoreId) : null,
    };
  }

  async create(userId: string, data: {
    addressId?: string;
    pickupStoreId?: string;
    fulfillmentType?: string;
    couponId?: string;
    pointsDeduct?: number;
    sourceType?: string;
    sourceCode?: string;
    shareRecordId?: string;
    shareCampaignId?: string;
    referrerUserId?: string;
    remark?: string;
    items: { skuId: string; quantity: number }[];
  }) {
    const fulfillmentType = data.fulfillmentType || 'delivery';

    if (fulfillmentType === 'delivery' && !data.addressId) {
      throw new BadRequestException('快递配送必须选择收货地址');
    }
    if (fulfillmentType === 'pickup' && !data.pickupStoreId) {
      throw new BadRequestException('到店自提必须选择自提点');
    }

    let address: any = null;
    let pickupStore: any = null;
    if (fulfillmentType === 'delivery') {
      address = await this.prisma.userAddress.findFirst({
        where: { id: BigInt(data.addressId!), userId: BigInt(userId), deletedAt: null },
      });
      if (!address) throw new NotFoundException('收货地址不存在');
    }
    if (fulfillmentType === 'pickup') {
      pickupStore = await this.prisma.pickupStore.findFirst({
        where: { id: BigInt(data.pickupStoreId!), status: 1, deletedAt: null },
      });
      if (!pickupStore) throw new NotFoundException('自提点不存在或已停用');
    }

    const orderItems: any[] = [];
    let totalAmount = 0;
    let activityDiscountAmount = 0;
    const skuStockChecks: { skuId: bigint; quantity: number; beforeStock: number }[] = [];

    for (const item of data.items) {
      const sku = await this.prisma.productSku.findFirst({
        where: { id: BigInt(item.skuId), status: 1 },
        include: { product: true },
      });
      if (!sku) throw new NotFoundException(`SKU ${item.skuId} 不存在或已下架`);
      if (sku.product.status !== 1) throw new BadRequestException(`商品 ${sku.product.name} 已下架`);
      if (sku.stock < item.quantity) throw new BadRequestException(`商品 ${sku.product.name} 库存不足`);

      const subtotal = sku.price * item.quantity;
      totalAmount += subtotal;

      skuStockChecks.push({ skuId: sku.id, quantity: item.quantity, beforeStock: sku.stock });

      orderItems.push({
        productId: sku.productId,
        skuId: sku.id,
        productName: sku.product.name,
        skuSpecs: sku.specs,
        productImage: pickOrderProductImage(sku.image, sku.product.mainImage),
        price: sku.price,
        originalPrice: sku.originalPrice,
        quantity: item.quantity,
        subtotal,
        supplierId: sku.product.supplierId,
      });
    }

    let couponAmount = 0;
    let couponId: bigint | null = null;
    if (data.couponId) {
      const userCoupon = await this.prisma.userCoupon.findFirst({
        where: {
          id: BigInt(data.couponId),
          userId: BigInt(userId),
          status: COUPON_STATUS.FREE,
        },
        include: { coupon: true },
      });
      if (!userCoupon) throw new BadRequestException('优惠券不可用');
      if (!userCoupon.expireAt || new Date() > userCoupon.expireAt) throw new BadRequestException('优惠券已过期');
      if (totalAmount < userCoupon.coupon.minAmount) throw new BadRequestException('未达到优惠券使用门槛');

      couponId = userCoupon.id;
      couponAmount = this.calculateCouponAmount(userCoupon.coupon, totalAmount);
    }

    let pointsAmount = 0;
    let pointsDeducted = 0;
    if ((data.pointsDeduct || 0) > 0) {
      const user = await this.prisma.user.findFirst({
        where: { id: BigInt(userId) },
      });
      if (!user) throw new NotFoundException('用户不存在');
      const pointsBaseAmount = Math.max(0, totalAmount - activityDiscountAmount);
      const pointsDeduction = this.calculatePointsDeduction(pointsBaseAmount, user.availablePoints, data.pointsDeduct || 0);
      pointsDeducted = pointsDeduction.pointsDeducted;
      pointsAmount = pointsDeduction.pointsAmount;
    }

    const discountAmount = 0;
    let freightAmount = 0;
    if (fulfillmentType === 'delivery') {
      freightAmount = this.calculateFreight(totalAmount, address.province);
    }
    const payAmount = this.calculatePayAmount({
      totalAmount,
      discountAmount,
      couponAmount,
      activityDiscountAmount,
      pointsAmount,
      freightAmount,
    });

    const isZeroPay = payAmount === 0;
    const needPickupCode = isZeroPay && fulfillmentType === 'pickup';
    const allowedSourceTypes = new Set(['direct', 'user_referral', 'merchant_referral', 'campaign']);
    const sourceType = data.sourceType && allowedSourceTypes.has(data.sourceType) ? data.sourceType : 'direct';
    const sourceCode = data.sourceCode?.trim() || null;
    const shareRecordId = data.shareRecordId ? BigInt(data.shareRecordId) : null;
    const shareCampaignId = data.shareCampaignId ? BigInt(data.shareCampaignId) : null;
    const referrerUserId = data.referrerUserId ? BigInt(data.referrerUserId) : null;

    const order = await this.prisma.$transaction(async (tx) => {
      for (const check of skuStockChecks) {
        const updated = await tx.productSku.updateMany({
          where: { id: check.skuId, stock: { gte: check.quantity } },
          data: { stock: { decrement: check.quantity }, sales: { increment: check.quantity } },
        });
        if (updated.count === 0) {
          this.businessEvent.emitWarn('stock_insufficient', 'stock', `并发扣库存失败: SKU ${check.skuId}`, check.skuId.toString(), { skuId: check.skuId.toString(), quantity: check.quantity, beforeStock: check.beforeStock });
          throw new BadRequestException('库存不足，下单失败');
        }

        const skuAfterDeduct = await tx.productSku.findFirst({
          where: { id: check.skuId },
          select: { productId: true, stock: true },
        });
        if (!skuAfterDeduct) {
          throw new BadRequestException('SKU不存在，下单失败');
        }
        const afterStock = skuAfterDeduct.stock;
        const beforeStock = afterStock + check.quantity;
        await tx.productStockLog.create({
          data: {
            productId: skuAfterDeduct.productId,
            skuId: check.skuId,
            type: 1,
            quantity: check.quantity,
            beforeStock,
            afterStock,
            reason: '订单预扣库存',
          },
        });
      }

      if (pointsDeducted > 0) {
        const user = await tx.user.findFirst({ where: { id: BigInt(userId) } });
        if (!user || user.availablePoints < pointsDeducted) {
          throw new BadRequestException('积分不足');
        }
        const pointsClaim = await tx.user.updateMany({
          where: { id: BigInt(userId), availablePoints: { gte: pointsDeducted } },
          data: {
            availablePoints: { decrement: pointsDeducted },
          },
        });
        if (pointsClaim.count === 0) {
          throw new BadRequestException('积分不足');
        }
        const updatedUser = await tx.user.findFirst({ where: { id: BigInt(userId) } });
        await tx.pointsRecord.create({
          data: {
            userId: BigInt(userId),
            type: 2,
            points: pointsDeducted,
            balance: updatedUser?.availablePoints ?? (user.availablePoints - pointsDeducted),
            source: 'order_deduct',
            description: `订单积分抵扣，扣除${pointsDeducted}积分`,
          },
        });
      }

      if (couponId) {
        const lockResult = await tx.userCoupon.updateMany({
          where: { id: couponId, userId: BigInt(userId), status: COUPON_STATUS.FREE },
          data: { status: COUPON_STATUS.LOCKED },
        });
        if (lockResult.count === 0) {
          throw new BadRequestException('优惠券已被使用或锁定');
        }
      }

      const createdOrder = await tx.order.create({
        data: {
          orderNo: generateOrderNo(),
          userId: BigInt(userId),
          status: isZeroPay
            ? (fulfillmentType === 'pickup' ? OrderStatus.pending_pickup : OrderStatus.pending_delivery)
            : OrderStatus.pending_payment,
          totalAmount,
          discountAmount,
          freightAmount,
          pointsAmount,
          payAmount,
          pointsDeducted,
          couponId,
          couponAmount,
          activityDiscountAmount,
          fulfillmentType,
          sourceType,
          sourceCode,
          shareRecordId,
          shareCampaignId,
          referrerUserId,
          ...(fulfillmentType === 'delivery' ? {
            receiverName: address.receiverName,
            receiverPhone: address.receiverPhone,
            province: address.province,
            city: address.city,
            district: address.district,
            detailAddress: address.detailAddress,
          } : {
            receiverName: '',
            receiverPhone: '',
            pickupStoreId: pickupStore.id,
            pickupStoreName: pickupStore.name,
            pickupStoreAddress: `${pickupStore.province}${pickupStore.city}${pickupStore.district}${pickupStore.address}`,
            pickupContactPhone: pickupStore.contactPhone,
          }),
          remark: data.remark,
          ...(isZeroPay ? { paidAt: new Date() } : { autoCloseAt: new Date(Date.now() + ORDER_AUTO_CLOSE_MINUTES * 60 * 1000) }),
          orderItems: {
            create: orderItems,
          },
          orderLogs: {
            create: {
              operatorType: 'user',
              operatorId: BigInt(userId),
              action: 'create',
              content: '用户下单',
            },
          },
        },
        include: { orderItems: { include: { aftersaleOrders: true } } },
      });

      if (needPickupCode) {
        await this.assignUniquePickupCode(tx, createdOrder.id);
      }

      if (couponId) {
        await tx.userCoupon.update({
          where: { id: couponId },
          data: { usedOrderId: createdOrder.id },
        });
      }

      const { Prisma } = await import('@prisma/client');
      let paymentCreated = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        const paymentNo = generatePaymentNo();
        try {
          await tx.orderPayment.create({
            data: {
              orderId: createdOrder.id,
              paymentNo,
              amount: payAmount,
              paymentMethod: isZeroPay ? 'zero_pay' : 'wechat',
              status: isZeroPay ? PAYMENT_STATUS.SUCCESS : PAYMENT_STATUS.CREATED,
              ...(isZeroPay ? { paidAt: new Date() } : {}),
            },
          });
          paymentCreated = true;
          break;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            this.logger.warn(`支付单号 ${paymentNo} 冲突，第 ${attempt + 1} 次重试`);
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
            orderId: createdOrder.id,
            operatorType: 'system',
            action: 'pay_zero_amount',
            content: '0元订单自动支付成功',
          },
        });

        if (couponId) {
          await tx.userCoupon.update({
            where: { id: couponId },
            data: { status: COUPON_STATUS.USED, usedAt: new Date() },
          });
        }
      }

      await tx.cart.deleteMany({
        where: {
          userId: BigInt(userId),
          skuId: { in: data.items.map((i) => BigInt(i.skuId)) },
        },
      });

      return createdOrder;
    });

    this.logger.log(`用户${userId}创建订单：${order.orderNo}，实付${payAmount}分`);

    // 零元支付即支付成功：发放绑定的权益卡，失败不影响主流程
    if (isZeroPay) {
      try {
        await this.benefitPackageService.grantBenefitsForOrder(order.id, userId);
      } catch (err) {
        this.logger.error(`权益卡发放失败(零元支付): orderId=${order.id}`, (err as Error)?.message);
      }
    }

    return {
      orderId: order.id.toString(),
      orderNo: order.orderNo,
      payAmount,
      isZeroPay,
      status: order.status,
      fulfillmentType,
    };
  }

  async cancel(userId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: BigInt(id), userId: BigInt(userId) },
      include: { orderItems: true },
    });
    if (!order) throw new NotFoundException('订单不存在');

    const result = await this.prisma.$transaction(async (tx) => {
      const claimResult = await tx.order.updateMany({
        where: { id: BigInt(id), userId: BigInt(userId), status: OrderStatus.pending_payment },
        data: {
          status: OrderStatus.cancelled,
          cancelledAt: new Date(),
          cancelReason: '用户主动取消',
        },
      });

      if (claimResult.count === 0) {
        const currentOrder = await tx.order.findFirst({ where: { id: BigInt(id) } });
        if (!currentOrder) throw new NotFoundException('订单不存在');
        if (currentOrder.status === OrderStatus.cancelled) {
          return currentOrder;
        }
        const paidStatuses: OrderStatus[] = [OrderStatus.pending_delivery, OrderStatus.pending_pickup, OrderStatus.delivered, OrderStatus.completed, OrderStatus.aftersale];
        if (paidStatuses.includes(currentOrder.status)) {
          throw new BadRequestException('订单已支付或状态已变化，不能取消');
        }
        throw new BadRequestException(`订单状态不允许取消: ${currentOrder.status}`);
      }

      for (const item of order.orderItems) {
        await this.restoreSkuStockAndSales(tx, item, '取消订单归还库存', 2);
      }

      if (order.pointsDeducted > 0) {
        const user = await tx.user.findFirst({ where: { id: BigInt(userId) } });
        if (user) {
          await tx.user.update({
            where: { id: BigInt(userId) },
            data: {
              availablePoints: { increment: order.pointsDeducted },
            },
          });
          await tx.pointsRecord.create({
            data: {
              userId: BigInt(userId),
              type: 1,
              points: order.pointsDeducted,
              balance: user.availablePoints + order.pointsDeducted,
              source: 'order_cancel',
              description: `取消订单归还积分${order.pointsDeducted}`,
            },
          });
        }
      }

      if (order.couponId) {
        await tx.userCoupon.updateMany({
          where: { id: order.couponId, status: { in: [COUPON_STATUS.LOCKED, COUPON_STATUS.USED] } },
          data: { status: COUPON_STATUS.FREE, usedOrderId: null, usedAt: null },
        });
      }

      await tx.orderLog.create({
        data: {
          orderId: BigInt(id),
          operatorType: 'user',
          operatorId: BigInt(userId),
          action: 'cancel',
          content: '用户取消订单',
        },
      });

      return tx.order.findFirst({ where: { id: BigInt(id) } });
    });

    this.logger.log(`用户${userId}取消订单：${id}`);

    // 拼团成员取消：将对应 member 标记为 cancelled，失败不影响订单取消主流程
    try {
      await this.groupBuyService.handleOrderCancel(id);
    } catch (err) {
      this.logger.error(`拼团成员取消失败: orderId=${id}`, (err as Error).message);
    }

    return this.serializeOrderView(result);
  }

  async confirmReceive(userId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: BigInt(id), userId: BigInt(userId) },
      include: { orderItems: true, delivery: true },
    });
    if (!order) throw new NotFoundException('订单不存在');
    const result = await this.completeOrderAndReward({
      order,
      claimWhere: { id: BigInt(id), userId: BigInt(userId), status: OrderStatus.delivered },
      orderUpdateData: { status: OrderStatus.completed, completedAt: new Date() },
      operatorType: 'user',
      operatorId: BigInt(userId),
      action: 'confirm_receive',
      logContent: '用户确认收货',
      completeReason: '确认收货',
      rewardSource: 'order_complete',
      markDeliveryReceivedAt: true,
    });

    this.logger.log(`用户${userId}确认收货：${id}`);
    return this.serializeOrderView(result);
  }

  async findPickupOrderByCode(pickupCode: string) {
    const order = await this.prisma.order.findFirst({
      where: { pickupCode },
      include: {
        orderItems: true,
        user: { select: { id: true, nickname: true, phone: true } },
      },
    });
    if (!order) throw new NotFoundException('自提码不存在');
    if (order.fulfillmentType !== 'pickup') {
      throw new BadRequestException('该订单不是自提订单');
    }
    const view = this.serializeOrderView(order);
    return {
      orderId: view.id,
      orderNo: view.orderNo,
      status: view.status,
      fulfillmentType: view.fulfillmentType,
      totalAmount: view.totalAmount,
      payAmount: view.payAmount,
      userName: view.user?.nickname || '',
      userPhone: view.user?.phone || '',
      items: view.items,
      pickupStoreName: view.pickupStoreName,
      pickupStoreAddress: view.pickupStoreAddress,
      pickupContactPhone: view.pickupContactPhone,
      pickupCode: view.pickupCode,
      pickedUpAt: view.pickedUpAt,
      createTime: view.createTime,
      alreadyCompleted: order.status === OrderStatus.completed,
    };
  }

  async completePickupOrderByCode(pickupCode: string, verifiedBy: string) {
    const order = await this.prisma.order.findFirst({
      where: { pickupCode },
      include: { orderItems: true },
    });
    if (!order) throw new NotFoundException('自提码不存在');
    if (order.fulfillmentType !== 'pickup') {
      throw new BadRequestException('该订单不是自提订单');
    }
    if (order.status === OrderStatus.completed) {
      return {
        success: true,
        orderId: order.id.toString(),
        orderNo: order.orderNo,
        pickedUpAt: order.pickedUpAt ?? order.completedAt ?? null,
        alreadyCompleted: true,
      };
    }
    assertOrderTransition(order.status, OrderStatus.completed, 'pickup_verify');

    const pickedUpAt = new Date();
    const updated = await this.completeOrderAndReward({
      order,
      claimWhere: { id: order.id, status: OrderStatus.pending_pickup, pickedUpAt: null },
      orderUpdateData: {
        status: OrderStatus.completed,
        completedAt: pickedUpAt,
        pickedUpAt,
        pickupVerifiedBy: BigInt(verifiedBy),
      },
      operatorType: 'admin',
      operatorId: BigInt(verifiedBy),
      action: 'pickup_verify',
      logContent: `自提核销，自提码：${pickupCode}`,
      completeReason: '自提核销',
      rewardSource: 'order_complete',
    });
    if (!updated) {
      throw new NotFoundException('订单不存在');
    }

    return {
      success: true,
      orderId: updated.id.toString(),
      orderNo: updated.orderNo,
      pickedUpAt: updated.pickedUpAt ?? pickedUpAt,
    };
  }

  async findByUser(userId: string, dto: OrderQueryDto) {
    const where: any = { userId: BigInt(userId) };
    if (dto.status) where.status = dto.status;
    if (dto.orderNo) where.orderNo = { contains: dto.orderNo };
    if (dto.startDate || dto.endDate) {
      where.createdAt = {};
      if (dto.startDate) where.createdAt.gte = new Date(dto.startDate);
      if (dto.endDate) where.createdAt.lte = new Date(dto.endDate);
    }

    const [list, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip: dto.skip,
        take: dto.take,
        orderBy: { createdAt: 'desc' },
        include: { orderItems: { include: { aftersaleOrders: true } } },
      }),
      this.prisma.order.count({ where }),
    ]);

    this.logger.log(`用户${userId}查询订单列表，共${total}条`);
    return paginate(list.map((o) => this.serializeOrderView(o)), total, dto.page, dto.pageSize);
  }

  async findById(userId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: BigInt(id), userId: BigInt(userId) },
      include: {
        orderItems: { include: { aftersaleOrders: true } },
        payment: true,
        delivery: true,
        orderLogs: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!order) throw new NotFoundException('订单不存在');
    return this.serializeOrderView(order);
  }

  async findAllAdmin(dto: OrderQueryDto) {
    const where = this.buildAdminOrderWhere(dto);

    const [list, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip: dto.skip,
        take: dto.take,
        orderBy: { createdAt: 'desc' },
        include: {
          orderItems: { include: { aftersaleOrders: true } },
          user: { select: { id: true, nickname: true, phone: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    this.logger.log(`管理员查询订单列表，共${total}条`);
    return paginate(list.map((o) => this.serializeOrderView(o)), total, dto.page, dto.pageSize);
  }

  async findAdminById(id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: BigInt(id) },
      include: {
        orderItems: { include: { aftersaleOrders: true } },
        payment: true,
        delivery: true,
        orderLogs: { orderBy: { createdAt: 'desc' } },
        user: { select: { id: true, nickname: true, phone: true } },
      },
    });
    if (!order) throw new NotFoundException('订单不存在');
    return this.serializeOrderView(order);
  }

  async adminCancel(id: string, reason: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: BigInt(id) },
      include: { orderItems: true },
    });
    if (!order) throw new NotFoundException('订单不存在');

    const result = await this.prisma.$transaction(async (tx) => {
      const claimResult = await tx.order.updateMany({
        where: { id: BigInt(id), status: OrderStatus.pending_payment },
        data: {
          status: OrderStatus.cancelled,
          cancelledAt: new Date(),
          cancelReason: reason || '管理员取消',
        },
      });

      if (claimResult.count === 0) {
        const currentOrder = await tx.order.findFirst({ where: { id: BigInt(id) } });
        if (!currentOrder) throw new NotFoundException('订单不存在');
        if (currentOrder.status === OrderStatus.cancelled) {
          return currentOrder;
        }
        const paidStatuses: OrderStatus[] = [OrderStatus.pending_delivery, OrderStatus.pending_pickup, OrderStatus.delivered, OrderStatus.completed, OrderStatus.aftersale];
        if (paidStatuses.includes(currentOrder.status)) {
          throw new BadRequestException('订单已支付，不能取消');
        }
        throw new BadRequestException(`订单状态不允许取消: ${currentOrder.status}`);
      }

      for (const item of order.orderItems) {
        await this.restoreSkuStockAndSales(tx, item, '管理员取消订单归还库存', 2);
      }

      if (order.pointsDeducted > 0) {
        const user = await tx.user.findFirst({ where: { id: order.userId } });
        if (user) {
          await tx.user.update({
            where: { id: order.userId },
            data: {
              availablePoints: { increment: order.pointsDeducted },
            },
          });
          await tx.pointsRecord.create({
            data: {
              userId: order.userId,
              type: 1,
              points: order.pointsDeducted,
              balance: user.availablePoints + order.pointsDeducted,
              source: 'admin_cancel',
              description: `管理员取消订单归还积分${order.pointsDeducted}`,
            },
          });
        }
      }

      if (order.couponId) {
        await tx.userCoupon.updateMany({
          where: { id: order.couponId, status: COUPON_STATUS.LOCKED },
          data: { status: COUPON_STATUS.FREE, usedOrderId: null },
        });
      }

      await tx.orderLog.create({
        data: {
          orderId: BigInt(id),
          operatorType: 'admin',
          action: 'cancel',
          content: `管理员取消订单，原因：${reason || '无'}`,
        },
      });

      return tx.order.findFirst({ where: { id: BigInt(id) } });
    });

    this.logger.log(`管理员取消订单：${id}，原因：${reason}`);
    return this.serializeOrderView(result);
  }

  async findDeliveryList(dto: OrderQueryDto) {
    const where: any = { status: OrderStatus.pending_delivery };
    if (dto.orderNo) where.orderNo = { contains: dto.orderNo };
    if (dto.fulfillmentType) where.fulfillmentType = dto.fulfillmentType;
    if (dto.startDate || dto.endDate) {
      where.createdAt = {};
      if (dto.startDate) where.createdAt.gte = new Date(dto.startDate);
      if (dto.endDate) where.createdAt.lte = new Date(dto.endDate);
    }

    const [list, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip: dto.skip,
        take: dto.take,
        orderBy: { createdAt: 'desc' },
        include: {
          orderItems: { include: { aftersaleOrders: true } },
          user: { select: { id: true, nickname: true, phone: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    this.logger.log(`查询待发货列表，共${total}条`);
    return paginate(list.map((o) => this.serializeOrder(o)), total, dto.page, dto.pageSize);
  }

  async batchDeliver(dto: BatchDeliverDto) {
    const results: any[] = [];
    const errors: any[] = [];

    for (const item of dto.orders) {
      try {
        const result = await this.adminDeliver({
          orderId: item.orderId,
          logisticsCompany: item.logisticsCompany,
          logisticsNo: item.logisticsNo,
        });
        results.push({ orderId: item.orderId, success: true, data: result });
      } catch (error) {
        errors.push({ orderId: item.orderId, success: false, message: (error as Error).message });
      }
    }

    this.logger.log(`批量发货完成，成功${results.length}条，失败${errors.length}条`);
    return { successCount: results.length, failCount: errors.length, results, errors };
  }

  async adminDeliver(dto: DeliverDto) {
    const orderId = BigInt(dto.orderId);
    const orderViewInclude = {
      orderItems: { include: { aftersaleOrders: true } },
      payment: true,
      delivery: true,
      orderLogs: { orderBy: { createdAt: 'desc' as const } },
      user: { select: { id: true, nickname: true, phone: true } },
    };

    const deliveredAt = new Date();
    const autoCompleteAt = new Date(deliveredAt.getTime() + ORDER_AUTO_COMPLETE_DAYS * 24 * 60 * 60 * 1000);

    const { order, delivered } = await this.prisma.$transaction(async (tx) => {
      const claimResult = await tx.order.updateMany({
        where: { id: orderId, status: OrderStatus.pending_delivery },
        data: {
          status: OrderStatus.delivered,
          deliveredAt,
          autoCompleteAt,
        },
      });

      if (claimResult.count === 0) {
        const currentOrder = await tx.order.findFirst({
          where: { id: orderId },
          include: orderViewInclude,
        });
        if (!currentOrder) throw new NotFoundException('订单不存在');
        if (currentOrder.status === OrderStatus.delivered) {
          if (currentOrder.delivery) {
            return { order: currentOrder, delivered: false };
          }
          throw new BadRequestException('订单已发货');
        }
        throw new BadRequestException(`订单状态不允许发货: ${currentOrder.status}`);
      }

      const existingDelivery = await tx.orderDelivery.findFirst({ where: { orderId } });
      if (!existingDelivery) {
        await tx.orderDelivery.create({
          data: {
            orderId,
            logisticsCompany: dto.logisticsCompany,
            logisticsNo: dto.logisticsNo,
            deliveryImages: dto.deliveryImages,
            deliveredAt,
          },
        });

        await tx.orderLog.create({
          data: {
            orderId,
            operatorType: 'admin',
            action: 'deliver',
            content: `管理员发货，物流公司：${dto.logisticsCompany}，物流单号：${dto.logisticsNo}`,
          },
        });
      }

      const currentOrder = await tx.order.findFirst({
        where: { id: orderId },
        include: orderViewInclude,
      });
      if (!currentOrder) throw new NotFoundException('订单不存在');
      return { order: currentOrder, delivered: !existingDelivery };
    });

    if (delivered) {
      this.logger.log(`管理员发货订单：${dto.orderId}，物流：${dto.logisticsCompany} ${dto.logisticsNo}`);
    }
    return this.serializeOrderView(order);
  }

  async adminRemark(id: string, remark: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: BigInt(id) },
    });
    if (!order) throw new NotFoundException('订单不存在');

    const result = await this.prisma.order.update({
      where: { id: BigInt(id) },
      data: { adminRemark: remark },
    });
    this.logger.log(`管理员备注订单：${id}`);
    return this.serializeOrderView(result);
  }

  async closeTimeoutOrders() {
    const timeoutOrders = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.pending_payment,
        autoCloseAt: { lte: new Date() },
      },
      include: { orderItems: true },
    });

    if (timeoutOrders.length === 0) return { closedCount: 0 };

    let closedCount = 0;
    for (const order of timeoutOrders) {
      try {
        const claimed = await this.prisma.$transaction(async (tx) => {
          const claimResult = await tx.order.updateMany({
            where: {
              id: order.id,
              status: OrderStatus.pending_payment,
              autoCloseAt: { lte: new Date() },
            },
            data: {
              status: OrderStatus.cancelled,
              cancelledAt: new Date(),
              cancelReason: '超时未支付自动关闭',
            },
          });

          if (claimResult.count === 0) {
            return false;
          }

          for (const item of order.orderItems) {
            await this.restoreSkuStockAndSales(tx, item, '超时自动关闭归还库存', 3);
          }

          if (order.pointsDeducted > 0) {
            const user = await tx.user.findFirst({ where: { id: order.userId } });
            if (user) {
              await tx.user.update({
                where: { id: order.userId },
                data: {
                  availablePoints: { increment: order.pointsDeducted },
                },
              });
              await tx.pointsRecord.create({
                data: {
                  userId: order.userId,
                  type: 1,
                  points: order.pointsDeducted,
                  balance: user.availablePoints + order.pointsDeducted,
                  source: 'order_auto_close',
                  description: `超时自动关闭归还积分${order.pointsDeducted}`,
                },
              });
            }
          }

          if (order.couponId) {
            await tx.userCoupon.updateMany({
              where: { id: order.couponId, status: { in: [COUPON_STATUS.LOCKED, COUPON_STATUS.USED] } },
              data: { status: COUPON_STATUS.FREE, usedOrderId: null, usedAt: null },
            });
          }

          await tx.orderLog.create({
            data: {
              orderId: order.id,
              operatorType: 'system',
              action: 'auto_close',
              content: '超时未支付，系统自动关闭订单',
            },
          });

          return true;
        });

        if (claimed) {
          closedCount++;
        }
      } catch (error) {
        this.logger.error(`自动关闭订单${order.orderNo}失败：${(error as Error).message}`);
      }
    }

    this.logger.log(`自动关闭超时订单，共${closedCount}条`);
    return { closedCount };
  }

  async autoCompleteOrders() {
    const orders = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.delivered,
        autoCompleteAt: { lte: new Date() },
      },
      include: { orderItems: true },
    });

    let completedCount = 0;
    for (const order of orders) {
      try {
        const completed = await this.completeOrderAndReward({
          order,
          claimWhere: { id: order.id, status: OrderStatus.delivered, autoCompleteAt: { lte: new Date() } },
          orderUpdateData: { status: OrderStatus.completed, completedAt: new Date() },
          operatorType: 'system',
          action: 'auto_complete',
          logContent: '超时未确认收货，系统自动完成',
          completeReason: '自动完成',
          rewardSource: 'order_auto_complete',
          swallowClaimFailure: true,
        }).then(() => true).catch(() => false);

        if (completed) {
          completedCount++;
        }
      } catch (error) {
        this.logger.error(`自动完成订单${order.orderNo}失败：${(error as Error).message}`);
      }
    }

    this.logger.log(`自动完成超时订单，共${completedCount}条`);
    return { completedCount };
  }

  async exportOrders(dto: OrderQueryDto) {
    const where = this.buildAdminOrderWhere(dto);

    const orders = await this.prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        orderItems: true,
        user: { select: { id: true, nickname: true, phone: true } },
      },
    });

    this.logger.log(`导出订单，共${orders.length}条`);
    return orders.map((o) => this.toOrderExportRow(o));
  }

  private buildAdminOrderWhere(dto: OrderQueryDto) {
    const where: any = {};
    if (dto.status) where.status = dto.status;
    if (dto.orderNo) where.orderNo = { contains: dto.orderNo };
    if (dto.fulfillmentType) where.fulfillmentType = dto.fulfillmentType;
    if (dto.startDate || dto.endDate) {
      where.createdAt = {};
      if (dto.startDate) where.createdAt.gte = new Date(dto.startDate);
      if (dto.endDate) where.createdAt.lte = new Date(dto.endDate);
    }
    return where;
  }

  private calculatePointsDeduction(baseAmount: number, availablePoints: number, requestedPoints: number) {
    const maxDeductAmount = Math.floor(baseAmount * POINTS_DEDUCT_MAX_PERCENT / 100);
    const maxPointsDeduct = Math.floor(maxDeductAmount / 100) * POINTS_DEDUCT_RATE;
    const normalizedAvailablePoints = Math.max(0, availablePoints || 0);
    const normalizedRequestedPoints = Math.max(0, requestedPoints || 0);

    if (normalizedRequestedPoints > 0) {
      if (normalizedRequestedPoints > normalizedAvailablePoints) {
        throw new BadRequestException('积分不足');
      }
      if (normalizedRequestedPoints % POINTS_DEDUCT_RATE !== 0) {
        throw new BadRequestException(`积分抵扣需按${POINTS_DEDUCT_RATE}积分为单位`);
      }
      if (maxPointsDeduct <= 0) {
        throw new BadRequestException('当前订单金额不满足积分抵扣');
      }
      if (normalizedRequestedPoints > maxPointsDeduct) {
        throw new BadRequestException('积分抵扣超过订单可用上限');
      }
    }

    const pointsDeducted = normalizedRequestedPoints;
    const pointsAmount = Math.floor(pointsDeducted / POINTS_DEDUCT_RATE) * 100;

    return {
      availablePoints: normalizedAvailablePoints,
      maxPointsDeduct,
      pointsDeducted,
      pointsAmount,
    };
  }

  private calculateCouponAmount(coupon: any, totalAmount: number): number {
    let couponAmount = 0;
    if (coupon.type === 1) {
      couponAmount = coupon.value;
    } else if (coupon.type === 2) {
      couponAmount = totalAmount - Math.floor(totalAmount * coupon.value / 1000);
    }
    if (coupon.discountLimit) {
      couponAmount = Math.min(couponAmount, coupon.discountLimit);
    }
    return Math.max(0, Math.min(couponAmount, totalAmount));
  }

  private calculatePayAmount(amounts: {
    totalAmount: number;
    discountAmount: number;
    couponAmount: number;
    activityDiscountAmount: number;
    pointsAmount: number;
    freightAmount: number;
  }): number {
    return Math.max(
      0,
      amounts.totalAmount
        - amounts.discountAmount
        - amounts.couponAmount
        - amounts.activityDiscountAmount
        - amounts.pointsAmount
        + amounts.freightAmount,
    );
  }

  private calculateFreight(totalAmount: number, province?: string): number {
    if (totalAmount >= FREIGHT_FREE_AMOUNT) {
      return 0;
    }
    if (province && FREIGHT_REMOTE_AREAS.some((area) => province.includes(area))) {
      return FREIGHT_REMOTE_FEE;
    }
    return FREIGHT_DEFAULT_FEE;
  }

  private async getPickupStoreInfo(pickupStoreId: string) {
    const store = await this.prisma.pickupStore.findFirst({
      where: { id: BigInt(pickupStoreId), status: 1, deletedAt: null },
    });
    if (!store) throw new NotFoundException('自提点不存在或已停用');
    return {
      id: store.id.toString(),
      name: store.name,
      address: `${store.province}${store.city}${store.district}${store.address}`,
      contactPhone: store.contactPhone,
      businessHours: store.businessHours,
      pickupNotice: store.pickupNotice,
    };
  }

  async generatePickupCode(maxRetries = 5): Promise<string> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const code = String(crypto.randomInt(10000000, 100000000));
      const existing = await this.prisma.order.findFirst({
        where: { pickupCode: code },
      });
      if (!existing) {
        return code;
      }
      this.logger.warn(`自提码 ${code} 已存在，第 ${attempt + 1} 次重试`);
    }
    throw new InternalServerErrorException('自提码生成失败，请重试');
  }

  async assignUniquePickupCode(tx: any, orderId: bigint, maxRetries = 5): Promise<string> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const code = await this.generatePickupCode();
      try {
        const result = await tx.order.updateMany({
          where: { id: orderId, pickupCode: null },
          data: { pickupCode: code },
        });
        if (result.count > 0) {
          return code;
        }
        const existing = await tx.order.findUnique({ where: { id: orderId }, select: { pickupCode: true } });
        if (existing?.pickupCode) {
          return existing.pickupCode;
        }
        continue;
      } catch (error: any) {
        if (
          error?.code === 'P2002' &&
          (error?.meta as any)?.target?.includes('pickupCode')
        ) {
          this.logger.warn(`自提码 ${code} 写入冲突(P2002)，第 ${attempt + 1} 次重试`);
          continue;
        }
        throw error;
      }
    }
    throw new InternalServerErrorException('自提码写入失败，请重试');
  }

  private async completeOrderAndReward(params: {
    order: any;
    claimWhere: any;
    orderUpdateData: any;
    operatorType: 'user' | 'admin' | 'system';
    operatorId?: bigint;
    action: string;
    logContent: string;
    completeReason: string;
    rewardSource?: string;
    markDeliveryReceivedAt?: boolean;
    swallowClaimFailure?: boolean;
  }) {
    const result = await this.prisma.$transaction(async (tx) => {
      const claimResult = await tx.order.updateMany({
        where: params.claimWhere,
        data: params.orderUpdateData,
      });

      if (claimResult.count === 0) {
        const currentOrder = await tx.order.findFirst({ where: { id: params.order.id } });
        if (!currentOrder) throw new NotFoundException('订单不存在');
        if (currentOrder.status === OrderStatus.completed) {
          return currentOrder;
        }
        if (params.swallowClaimFailure) {
          throw new BadRequestException('订单抢占失败');
        }
        throw new BadRequestException(`订单状态不允许${params.completeReason}: ${currentOrder.status}`);
      }

      const earnedPoints = await this.rewardCompletedOrder(tx, params.order, params.rewardSource || 'order_complete');

      if (params.markDeliveryReceivedAt && params.order.delivery) {
        await tx.orderDelivery.update({
          where: { orderId: params.order.id },
          data: { receivedAt: new Date() },
        });
      }

      await tx.orderLog.create({
        data: {
          orderId: params.order.id,
          operatorType: params.operatorType,
          operatorId: params.operatorId,
          action: params.action,
          content: `${params.logContent}${earnedPoints > 0 ? `，发放积分${earnedPoints}` : ''}`,
        },
      });

      return tx.order.findFirst({ where: { id: params.order.id } });
    });

    return result;
  }

  private async rewardCompletedOrder(tx: any, order: any, rewardSource: string) {
    const earnedPoints = Math.floor((order.payAmount || 0) / 100);
    if (earnedPoints <= 0) {
      return 0;
    }

    const existingRecord = await tx.pointsRecord.findFirst({
      where: { source: rewardSource, sourceId: order.id },
    });
    if (existingRecord) {
      return 0;
    }

    const user = await tx.user.findFirst({ where: { id: order.userId } });
    if (!user) {
      return 0;
    }

    await tx.user.update({
      where: { id: order.userId },
      data: {
        availablePoints: { increment: earnedPoints },
        totalPoints: { increment: earnedPoints },
        growthValue: { increment: earnedPoints },
      },
    });

    await tx.pointsRecord.create({
      data: {
        userId: order.userId,
        type: 1,
        points: earnedPoints,
        balance: user.availablePoints + earnedPoints,
        source: rewardSource,
        sourceId: order.id,
        description: `完成订单奖励${earnedPoints}积分`,
      },
    });

    return earnedPoints;
  }

  private async restoreSkuStockAndSales(tx: any, item: any, reason: string, type: number) {
    const sku = await tx.productSku.findFirst({ where: { id: item.skuId } });
    if (!sku) {
      return;
    }

    await tx.productSku.update({
      where: { id: item.skuId },
      data: { stock: { increment: item.quantity } },
    });
    await this.safeDecrementSkuSales(tx, item.skuId, item.quantity);
    await tx.productStockLog.create({
      data: {
        productId: item.productId,
        skuId: item.skuId,
        type,
        quantity: item.quantity,
        beforeStock: sku.stock,
        afterStock: sku.stock + item.quantity,
        reason,
      },
    });
  }

  private async safeDecrementSkuSales(tx: any, skuId: bigint, quantity: number) {
    if (typeof tx.$executeRaw === 'function') {
      await tx.$executeRaw`
        UPDATE product_skus
        SET sales = GREATEST(sales - ${quantity}, 0)
        WHERE id = ${skuId}
      `;
      return;
    }

    const sku = await tx.productSku.findFirst({ where: { id: skuId } });
    if (!sku) return;
    const nextSales = Math.max((sku.sales || 0) - quantity, 0);
    await tx.productSku.update({
      where: { id: skuId },
      data: { sales: nextSales },
    });
  }

  private findActiveAftersale(orderItem: any) {
    const activeStatuses = [
      AftersaleStatus.pending_review,
      AftersaleStatus.approved,
      AftersaleStatus.returned,
      AftersaleStatus.pending_refund,
    ];
    return orderItem.aftersaleOrders?.find((a: any) => activeStatuses.includes(a.status));
  }

  private serializeOrder(order: any) {
    return {
      ...order,
      id: order.id.toString(),
      userId: order.userId?.toString(),
      couponId: order.couponId?.toString(),
      pickupStoreId: order.pickupStoreId?.toString(),
      pickupVerifiedBy: order.pickupVerifiedBy?.toString(),
      sourceType: order.sourceType || 'direct',
      sourceCode: order.sourceCode || undefined,
      shareRecordId: order.shareRecordId?.toString(),
      shareCampaignId: order.shareCampaignId?.toString(),
      referrerUserId: order.referrerUserId?.toString(),
      fulfillmentType: order.fulfillmentType || 'delivery',
      orderItems: order.orderItems?.map((i: any) => ({
        ...i,
        id: i.id.toString(),
        orderId: i.orderId?.toString(),
        productId: i.productId.toString(),
        skuId: i.skuId.toString(),
        activityId: i.activityId?.toString(),
        supplierId: i.supplierId?.toString(),
        aftersaleOrders: i.aftersaleOrders?.map((a: any) => ({
          ...a,
          id: a.id.toString(),
          orderId: a.orderId?.toString(),
          orderItemId: a.orderItemId?.toString(),
          userId: a.userId?.toString(),
          activeOrderItemId: a.activeOrderItemId?.toString(),
        })),
      })),
      payment: order.payment
        ? {
            ...order.payment,
            id: order.payment.id.toString(),
            orderId: order.payment.orderId?.toString(),
          }
        : null,
      delivery: order.delivery
        ? {
            ...order.delivery,
            id: order.delivery.id.toString(),
            orderId: order.delivery.orderId?.toString(),
          }
        : null,
      orderLogs: order.orderLogs?.map((l: any) => ({
        ...l,
        id: l.id.toString(),
        orderId: l.orderId?.toString(),
        operatorId: l.operatorId?.toString(),
      })),
      user: order.user
        ? { ...order.user, id: order.user.id.toString() }
        : null,
    };
  }

  private serializeOrderView(order: any) {
    const base = this.serializeOrder(order);
    const addressDetail = [order.province, order.city, order.district, order.detailAddress].filter(Boolean).join(' ');
    const normalizeLogisticsTraces = (logisticsInfo: any) => {
      if (!logisticsInfo) return [];
      if (Array.isArray(logisticsInfo)) return logisticsInfo;

      if (typeof logisticsInfo === 'string') {
        try {
          const parsed = JSON.parse(logisticsInfo);
          if (Array.isArray(parsed)) return parsed;
          if (Array.isArray(parsed?.traces)) return parsed.traces;
          return [];
        } catch {
          return [];
        }
      }

      if (Array.isArray(logisticsInfo.traces)) return logisticsInfo.traces;
      return [];
    };

    return {
      id: base.id,
      orderNo: base.orderNo,
      status: base.status,
      totalAmount: base.totalAmount,
      discountAmount: base.discountAmount,
      couponAmount: base.couponAmount,
      activityDiscountAmount: base.activityDiscountAmount,
      pointsAmount: base.pointsAmount,
      freightAmount: base.freightAmount,
      payAmount: base.payAmount,
      addressName: order.receiverName || '',
      addressPhone: order.receiverPhone || '',
      addressDetail,
      consignee: order.receiverName || '',
      phone: order.receiverPhone || '',
      address: addressDetail,
      items: (base.orderItems || []).map((i: any) => {
        const activeAftersale = this.findActiveAftersale(i);
        const canApplyByOrderStatus = [OrderStatus.delivered, OrderStatus.completed, OrderStatus.aftersale].includes(order.status);
        return {
          id: i.id,
          productId: i.productId,
          skuId: i.skuId,
          productName: i.productName,
          skuName: formatSkuSpecs(i.skuSpecs),
          productImage: normalizeAssetUrl(i.productImage || ''),
          price: i.price,
          originalPrice: i.originalPrice,
          quantity: i.quantity,
          subtotal: i.subtotal,
          canApplyAftersale: canApplyByOrderStatus && !activeAftersale,
          aftersaleStatus: activeAftersale?.status,
          aftersaleDisabledReason: activeAftersale
            ? '该商品已申请售后'
            : canApplyByOrderStatus
              ? undefined
              : '当前订单状态不允许申请售后',
        };
      }),
      logistics: base.delivery ? {
        company: base.delivery.logisticsCompany || '',
        trackingNo: base.delivery.logisticsNo || '',
        traces: normalizeLogisticsTraces(base.delivery.logisticsInfo),
      } : null,
      createTime: order.createdAt ? new Date(order.createdAt).toLocaleString('zh-CN') : '',
      payTime: order.paidAt ? new Date(order.paidAt).toLocaleString('zh-CN') : undefined,
      deliveryTime: order.deliveredAt ? new Date(order.deliveredAt).toLocaleString('zh-CN') : undefined,
      shipTime: order.deliveredAt ? new Date(order.deliveredAt).toLocaleString('zh-CN') : undefined,
      finishTime: order.completedAt ? new Date(order.completedAt).toLocaleString('zh-CN') : undefined,
      receiveTime: order.completedAt ? new Date(order.completedAt).toLocaleString('zh-CN') : undefined,
      remark: order.remark || undefined,
      sourceType: base.sourceType || 'direct',
      sourceCode: base.sourceCode || undefined,
      shareRecordId: base.shareRecordId || undefined,
      shareCampaignId: base.shareCampaignId || undefined,
      referrerUserId: base.referrerUserId || undefined,
      fulfillmentType: base.fulfillmentType || 'delivery',
      pickupStoreId: base.pickupStoreId,
      pickupStoreName: order.pickupStoreName,
      pickupStoreAddress: order.pickupStoreAddress,
      pickupContactPhone: order.pickupContactPhone,
      pickupCode: order.pickupCode,
      pickedUpAt: order.pickedUpAt,
      operationLogs: (base.orderLogs || []).map((l: any) => ({
        ...l,
        operator: l.operatorType === 'admin' ? '管理员' : '用户',
        content: l.content,
        createTime: l.createdAt ? new Date(l.createdAt).toLocaleString('zh-CN') : '',
      })),
      user: base.user || undefined,
      couponId: base.couponId,
    };
  }

  private toOrderExportRow(order: any) {
    const items = Array.isArray(order.orderItems) ? order.orderItems : [];
    const itemCount = items.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);
    const itemDetails = items
      .map((item: any) => {
        const specsText = formatSkuSpecs(item.skuSpecs);
        const skuText = specsText ? `（${specsText}）` : '';
        return `${item.productName}${skuText}x${item.quantity}`;
      })
      .join('；');
    const address = [order.province, order.city, order.district, order.detailAddress].filter(Boolean).join('');

    return {
      orderNo: order.orderNo || '',
      userNickname: order.user?.nickname || '',
      userPhone: order.user?.phone || '',
      status: order.status || '',
      fulfillmentType: order.fulfillmentType || 'delivery',
      itemCount,
      itemDetails,
      totalAmount: order.totalAmount || 0,
      discountAmount: order.discountAmount || 0,
      couponAmount: order.couponAmount || 0,
      activityDiscountAmount: order.activityDiscountAmount || 0,
      freightAmount: order.freightAmount || 0,
      pointsAmount: order.pointsAmount || 0,
      payAmount: order.payAmount || 0,
      consignee: order.receiverName || '',
      consigneePhone: order.receiverPhone || '',
      address,
      createdAt: order.createdAt || null,
      paidAt: order.paidAt || null,
    };
  }

}
