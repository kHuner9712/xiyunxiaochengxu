import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { OrderQueryDto } from './dto/order-query.dto';
import { DeliverDto, BatchDeliverDto } from './dto/deliver.dto';
import { generateOrderNo, paginate } from '@baby-mall/shared';
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
} from '@baby-mall/shared';
import { assertOrderTransition } from './order-state-machine';
import { COUPON_STATUS } from '../common/constants/payment';
import { BusinessEventService } from '../common/business-event.service';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private prisma: PrismaService,
    private businessEvent: BusinessEventService,
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
        productImage: sku.image || sku.product.mainImage,
        price: sku.price,
        originalPrice: sku.originalPrice,
        quantity: item.quantity,
        subtotal,
      });
    }

    let pointsAmount = 0;
    if (data.pointsDeduct && data.pointsDeduct > 0) {
      const user = await this.prisma.user.findFirst({
        where: { id: BigInt(userId) },
      });
      if (!user) throw new NotFoundException('用户不存在');
      if (data.pointsDeduct > user.availablePoints) {
        throw new BadRequestException('积分不足');
      }
      const maxPointsDeduct = Math.floor(totalAmount * POINTS_DEDUCT_MAX_PERCENT / 100) * POINTS_DEDUCT_RATE;
      const actualPointsDeduct = Math.min(data.pointsDeduct, maxPointsDeduct);
      pointsAmount = Math.floor(actualPointsDeduct / POINTS_DEDUCT_RATE);
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

      if (userCoupon.coupon.type === 1) {
        couponAmount = userCoupon.coupon.value;
        if (userCoupon.coupon.discountLimit) {
          couponAmount = Math.min(couponAmount, userCoupon.coupon.discountLimit);
        }
      } else if (userCoupon.coupon.type === 2) {
        couponAmount = totalAmount - Math.floor(totalAmount * userCoupon.coupon.value / 1000);
        if (userCoupon.coupon.discountLimit) {
          couponAmount = Math.min(couponAmount, userCoupon.coupon.discountLimit);
        }
      }
    }

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

    const payAmount = Math.max(0, totalAmount - discountAmount - couponAmount - activityDiscountAmount - pointsAmount + freightAmount);

    this.logger.log(`用户${userId}确认订单金额：商品${totalAmount}分，优惠${discountAmount + couponAmount + activityDiscountAmount}分，积分抵扣${pointsAmount}分，运费${freightAmount}分，实付${payAmount}分`);

    return {
      items: confirmItems,
      totalAmount,
      discountAmount,
      couponAmount,
      activityDiscountAmount,
      pointsAmount,
      freightAmount,
      payAmount,
      fulfillmentType,
      pickupStore: fulfillmentType === 'pickup' && data.pickupStoreId ? await this.getPickupStoreInfo(data.pickupStoreId) : null,
    };
  }

  async create(userId: string, data: {
    addressId?: string;
    pickupStoreId?: string;
    fulfillmentType?: string;
    couponId?: string;
    pointsDeduct?: number;
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
        productImage: sku.image || sku.product.mainImage,
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
      if (userCoupon.coupon.type === 1) {
        couponAmount = userCoupon.coupon.value;
        if (userCoupon.coupon.discountLimit) {
          couponAmount = Math.min(couponAmount, userCoupon.coupon.discountLimit);
        }
      } else if (userCoupon.coupon.type === 2) {
        couponAmount = totalAmount - Math.floor(totalAmount * userCoupon.coupon.value / 1000);
        if (userCoupon.coupon.discountLimit) {
          couponAmount = Math.min(couponAmount, userCoupon.coupon.discountLimit);
        }
      }
    }

    let pointsAmount = 0;
    let pointsDeducted = 0;
    if (data.pointsDeduct && data.pointsDeduct > 0) {
      const user = await this.prisma.user.findFirst({
        where: { id: BigInt(userId) },
      });
      if (!user) throw new NotFoundException('用户不存在');
      if (data.pointsDeduct > user.availablePoints) {
        throw new BadRequestException('积分不足');
      }
      const maxPointsDeduct = Math.floor(totalAmount * POINTS_DEDUCT_MAX_PERCENT / 100) * POINTS_DEDUCT_RATE;
      pointsDeducted = Math.min(data.pointsDeduct, maxPointsDeduct);
      pointsAmount = Math.floor(pointsDeducted / POINTS_DEDUCT_RATE);
    }

    const discountAmount = 0;
    let freightAmount = 0;
    if (fulfillmentType === 'delivery') {
      freightAmount = this.calculateFreight(totalAmount, address.province);
    }
    const payAmount = Math.max(0, totalAmount - discountAmount - couponAmount - activityDiscountAmount - pointsAmount + freightAmount);

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

        const afterStock = check.beforeStock - check.quantity;
        await tx.productStockLog.create({
          data: {
            productId: (await tx.productSku.findFirst({ where: { id: check.skuId } }))!.productId,
            skuId: check.skuId,
            type: 1,
            quantity: check.quantity,
            beforeStock: check.beforeStock,
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
        await tx.user.update({
          where: { id: BigInt(userId) },
          data: {
            availablePoints: { decrement: pointsDeducted },
          },
        });
        await tx.pointsRecord.create({
          data: {
            userId: BigInt(userId),
            type: 2,
            points: pointsDeducted,
            balance: user.availablePoints - pointsDeducted,
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
          status: OrderStatus.pending_payment,
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
          autoCloseAt: new Date(Date.now() + ORDER_AUTO_CLOSE_MINUTES * 60 * 1000),
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
        include: { orderItems: true },
      });

      if (couponId) {
        await tx.userCoupon.update({
          where: { id: couponId },
          data: { usedOrderId: createdOrder.id },
        });
      }

      const paymentNo = `PAY${Date.now()}${Math.random().toString(36).substring(2, 8)}`;
      await tx.orderPayment.create({
        data: {
          orderId: createdOrder.id,
          paymentNo,
          amount: payAmount,
          paymentMethod: 'wechat',
          status: 1,
        },
      });

      return createdOrder;
    });

    await this.prisma.cart.deleteMany({
      where: {
        userId: BigInt(userId),
        skuId: { in: data.items.map((i) => BigInt(i.skuId)) },
      },
    });

    if (fulfillmentType === 'pickup' && data.pickupStoreId) {
      const store = await this.prisma.pickupStore.findFirst({
        where: { id: BigInt(data.pickupStoreId), status: 1, deletedAt: null },
      });
      if (store) {
        await this.prisma.order.update({
          where: { id: order.id },
          data: {
            pickupStoreId: store.id,
            pickupStoreName: store.name,
            pickupStoreAddress: `${store.province}${store.city}${store.district}${store.address}`,
            pickupContactPhone: store.contactPhone,
          },
        });
      }
    }

    this.logger.log(`用户${userId}创建订单：${order.orderNo}，实付${payAmount}分`);
    return { orderId: order.id.toString(), orderNo: order.orderNo };
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
        const paidStatuses: OrderStatus[] = [OrderStatus.pending_delivery, OrderStatus.delivered, OrderStatus.completed, OrderStatus.aftersale];
        if (paidStatuses.includes(currentOrder.status)) {
          throw new BadRequestException('订单已支付或状态已变化，不能取消');
        }
        throw new BadRequestException(`订单状态不允许取消: ${currentOrder.status}`);
      }

      for (const item of order.orderItems) {
        const sku = await tx.productSku.findFirst({ where: { id: item.skuId } });
        if (sku) {
          await tx.productSku.update({
            where: { id: item.skuId },
            data: { stock: { increment: item.quantity }, sales: { decrement: item.quantity } },
          });
          await tx.productStockLog.create({
            data: {
              productId: item.productId,
              skuId: item.skuId,
              type: 2,
              quantity: item.quantity,
              beforeStock: sku.stock,
              afterStock: sku.stock + item.quantity,
              reason: '取消订单归还库存',
            },
          });
        }
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
          where: { id: order.couponId, status: COUPON_STATUS.LOCKED },
          data: { status: COUPON_STATUS.FREE, usedOrderId: null },
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
    return this.serializeOrderView(result);
  }

  async confirmReceive(userId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: BigInt(id), userId: BigInt(userId) },
      include: { orderItems: true, delivery: true },
    });
    if (!order) throw new NotFoundException('订单不存在');

    const result = await this.prisma.$transaction(async (tx) => {
      const claimResult = await tx.order.updateMany({
        where: { id: BigInt(id), userId: BigInt(userId), status: OrderStatus.delivered },
        data: { status: OrderStatus.completed, completedAt: new Date() },
      });

      if (claimResult.count === 0) {
        const currentOrder = await tx.order.findFirst({ where: { id: BigInt(id) } });
        if (!currentOrder) throw new NotFoundException('订单不存在');
        if (currentOrder.status === OrderStatus.completed) {
          return currentOrder;
        }
        throw new BadRequestException(`订单状态不允许确认收货: ${currentOrder.status}`);
      }

      const earnedPoints = Math.floor(order.payAmount! / 100);

      if (earnedPoints > 0) {
        const existingRecord = await tx.pointsRecord.findFirst({
          where: { source: 'order_complete', sourceId: order.id },
        });
        if (!existingRecord) {
          const user = await tx.user.findFirst({ where: { id: BigInt(userId) } });
          if (user) {
            await tx.user.update({
              where: { id: BigInt(userId) },
              data: {
                availablePoints: { increment: earnedPoints },
                totalPoints: { increment: earnedPoints },
                growthValue: { increment: Math.floor(order.payAmount! / 100) },
              },
            });
            await tx.pointsRecord.create({
              data: {
                userId: BigInt(userId),
                type: 1,
                points: earnedPoints,
                balance: user.availablePoints + earnedPoints,
                source: 'order_complete',
                sourceId: order.id,
                description: `完成订单奖励${earnedPoints}积分`,
              },
            });
          }
        }
      }

      if (order.delivery) {
        await tx.orderDelivery.update({
          where: { orderId: order.id },
          data: { receivedAt: new Date() },
        });
      }

      await tx.orderLog.create({
        data: {
          orderId: BigInt(id),
          operatorType: 'user',
          operatorId: BigInt(userId),
          action: 'confirm_receive',
          content: '用户确认收货，发放积分' + earnedPoints,
        },
      });

      return tx.order.findFirst({ where: { id: BigInt(id) } });
    });

    this.logger.log(`用户${userId}确认收货：${id}`);
    return this.serializeOrderView(result);
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
        include: { orderItems: true },
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
        orderItems: true,
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
          orderItems: true,
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
        orderItems: true,
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
        const paidStatuses: OrderStatus[] = [OrderStatus.pending_delivery, OrderStatus.delivered, OrderStatus.completed, OrderStatus.aftersale];
        if (paidStatuses.includes(currentOrder.status)) {
          throw new BadRequestException('订单已支付，不能取消');
        }
        throw new BadRequestException(`订单状态不允许取消: ${currentOrder.status}`);
      }

      for (const item of order.orderItems) {
        const sku = await tx.productSku.findFirst({ where: { id: item.skuId } });
        if (sku) {
          await tx.productSku.update({
            where: { id: item.skuId },
            data: { stock: { increment: item.quantity }, sales: { decrement: item.quantity } },
          });
          await tx.productStockLog.create({
            data: {
              productId: item.productId,
              skuId: item.skuId,
              type: 2,
              quantity: item.quantity,
              beforeStock: sku.stock,
              afterStock: sku.stock + item.quantity,
              reason: '管理员取消订单归还库存',
            },
          });
        }
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
          orderItems: true,
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
    const order = await this.prisma.order.findFirst({
      where: { id: BigInt(dto.orderId) },
    });
    if (!order) throw new NotFoundException('订单不存在');
    assertOrderTransition(order.status, OrderStatus.delivered, '发货');

    const result = await this.prisma.order.update({
      where: { id: BigInt(dto.orderId) },
      data: {
        status: OrderStatus.delivered,
        deliveredAt: new Date(),
        autoCompleteAt: new Date(Date.now() + ORDER_AUTO_COMPLETE_DAYS * 24 * 60 * 60 * 1000),
        delivery: {
          create: {
            logisticsCompany: dto.logisticsCompany,
            logisticsNo: dto.logisticsNo,
            deliveryImages: dto.deliveryImages,
            deliveredAt: new Date(),
          },
        },
        orderLogs: {
          create: {
            operatorType: 'admin',
            action: 'deliver',
            content: `管理员发货，物流公司：${dto.logisticsCompany}，物流单号：${dto.logisticsNo}`,
          },
        },
      },
    });

    this.logger.log(`管理员发货订单：${dto.orderId}，物流：${dto.logisticsCompany} ${dto.logisticsNo}`);
    return this.serializeOrderView(result);
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
            const sku = await tx.productSku.findFirst({ where: { id: item.skuId } });
            if (sku) {
              await tx.productSku.update({
                where: { id: item.skuId },
                data: { stock: { increment: item.quantity }, sales: { decrement: item.quantity } },
              });
              await tx.productStockLog.create({
                data: {
                  productId: item.productId,
                  skuId: item.skuId,
                  type: 3,
                  quantity: item.quantity,
                  beforeStock: sku.stock,
                  afterStock: sku.stock + item.quantity,
                  reason: '超时自动关闭归还库存',
                },
              });
            }
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
              where: { id: order.couponId, status: COUPON_STATUS.LOCKED },
              data: { status: COUPON_STATUS.FREE, usedOrderId: null },
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
        const completed = await this.prisma.$transaction(async (tx) => {
          const claimResult = await tx.order.updateMany({
            where: { id: order.id, status: OrderStatus.delivered, autoCompleteAt: { lte: new Date() } },
            data: { status: OrderStatus.completed, completedAt: new Date() },
          });

          if (claimResult.count === 0) {
            return false;
          }

          const earnedPoints = Math.floor(order.payAmount! / 100);

          if (earnedPoints > 0) {
            const existingRecord = await tx.pointsRecord.findFirst({
              where: { source: 'order_auto_complete', sourceId: order.id },
            });
            if (!existingRecord) {
              const user = await tx.user.findFirst({ where: { id: order.userId } });
              if (user) {
                await tx.user.update({
                  where: { id: order.userId },
                  data: {
                    availablePoints: { increment: earnedPoints },
                    totalPoints: { increment: earnedPoints },
                    growthValue: { increment: Math.floor(order.payAmount! / 100) },
                  },
                });
                await tx.pointsRecord.create({
                  data: {
                    userId: order.userId,
                    type: 1,
                    points: earnedPoints,
                    balance: user.availablePoints + earnedPoints,
                    source: 'order_auto_complete',
                    sourceId: order.id,
                    description: `自动完成订单奖励${earnedPoints}积分`,
                  },
                });
              }
            }
          }

          await tx.orderLog.create({
            data: {
              orderId: order.id,
              operatorType: 'system',
              action: 'auto_complete',
              content: '超时未确认收货，系统自动完成' + (earnedPoints > 0 ? `，发放积分${earnedPoints}` : ''),
            },
          });

          return true;
        });

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

  async generatePickupCode(): Promise<string> {
    let code: string;
    let exists = true;
    while (exists) {
      code = String(Math.floor(100000 + Math.random() * 900000));
      const existing = await this.prisma.order.findFirst({
        where: { pickupCode: code },
      });
      exists = !!existing;
    }
    return code!;
  }

  private serializeOrder(order: any) {
    return {
      ...order,
      id: order.id.toString(),
      userId: order.userId?.toString(),
      couponId: order.couponId?.toString(),
      pickupStoreId: order.pickupStoreId?.toString(),
      pickupVerifiedBy: order.pickupVerifiedBy?.toString(),
      fulfillmentType: order.fulfillmentType || 'delivery',
      orderItems: order.orderItems?.map((i: any) => ({
        ...i,
        id: i.id.toString(),
        orderId: i.orderId?.toString(),
        productId: i.productId.toString(),
        skuId: i.skuId.toString(),
        activityId: i.activityId?.toString(),
        supplierId: i.supplierId?.toString(),
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
      items: (base.orderItems || []).map((i: any) => ({
        id: i.id,
        productId: i.productId,
        skuId: i.skuId,
        productName: i.productName,
        skuName: i.skuSpecs || '',
        productImage: i.productImage || '',
        price: i.price,
        originalPrice: i.originalPrice,
        quantity: i.quantity,
        subtotal: i.subtotal,
      })),
      logistics: base.delivery ? {
        company: base.delivery.logisticsCompany || '',
        trackingNo: base.delivery.logisticsNo || '',
        traces: base.delivery.logisticsTraces ? (typeof base.delivery.logisticsTraces === 'string' ? JSON.parse(base.delivery.logisticsTraces) : base.delivery.logisticsTraces) : [],
      } : null,
      createTime: order.createdAt ? new Date(order.createdAt).toLocaleString('zh-CN') : '',
      payTime: order.paidAt ? new Date(order.paidAt).toLocaleString('zh-CN') : undefined,
      deliveryTime: order.shippedAt ? new Date(order.shippedAt).toLocaleString('zh-CN') : undefined,
      shipTime: order.shippedAt ? new Date(order.shippedAt).toLocaleString('zh-CN') : undefined,
      finishTime: order.completedAt ? new Date(order.completedAt).toLocaleString('zh-CN') : undefined,
      receiveTime: order.completedAt ? new Date(order.completedAt).toLocaleString('zh-CN') : undefined,
      remark: order.remark || undefined,
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
        const specsText = this.formatSkuSpecs(item.skuSpecs);
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

  private formatSkuSpecs(skuSpecs: unknown): string {
    if (skuSpecs === null || skuSpecs === undefined || skuSpecs === '') {
      return '';
    }

    if (typeof skuSpecs === 'string') {
      return skuSpecs;
    }

    if (typeof skuSpecs === 'object') {
      try {
        if (Array.isArray(skuSpecs)) {
          const segments = skuSpecs
            .map((item, index) => {
              if (item === null || item === undefined) {
                return '';
              }
              if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
                return String(item);
              }
              if (typeof item === 'object') {
                const objectItem = item as Record<string, unknown>;
                if (objectItem.key !== undefined && objectItem.value !== undefined) {
                  return `${this.formatSkuSpecValue(objectItem.key)}:${this.formatSkuSpecValue(objectItem.value)}`;
                }
                const objectEntries = Object.entries(objectItem);
                if (objectEntries.length > 0) {
                  return objectEntries
                    .map(([key, itemValue]) => `${key}:${this.formatSkuSpecValue(itemValue)}`)
                    .join(' / ');
                }
              }
              return `${index}:${this.formatSkuSpecValue(item)}`;
            })
            .filter(Boolean);
          if (segments.length > 0) {
            return segments.join(' / ');
          }
          return JSON.stringify(skuSpecs);
        }

        const value = skuSpecs as Record<string, unknown>;
        const entries = Object.entries(value);
        if (entries.length > 0) {
          return entries
            .map(([key, itemValue]) => `${key}:${this.formatSkuSpecValue(itemValue)}`)
            .join(' / ');
        }
        return JSON.stringify(skuSpecs);
      } catch {
        return String(skuSpecs);
      }
    }

    return String(skuSpecs);
  }

  private formatSkuSpecValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
}
