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

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(private prisma: PrismaService) {}

  async getOrderCountByUser(userId: string) {
    const where = { userId: BigInt(userId) };

    const [unpaid, unshipped, unreceived, aftersale] = await Promise.all([
      this.prisma.order.count({ where: { ...where, status: OrderStatus.pending_payment } }),
      this.prisma.order.count({ where: { ...where, status: OrderStatus.pending_delivery } }),
      this.prisma.order.count({ where: { ...where, status: OrderStatus.delivered } }),
      this.prisma.order.count({ where: { ...where, status: OrderStatus.aftersale } }),
    ]);

    return { unpaid, unshipped, unreceived, aftersale };
  }

  async confirm(userId: string, data: { items: { skuId: string; quantity: number }[]; addressId?: string; couponId?: string; pointsDeduct?: number }) {
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
      if (sku.stock < item.quantity) throw new BadRequestException(`商品 ${sku.product.name} 库存不足`);

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
          status: 1,
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
    };
  }

  async create(userId: string, data: {
    addressId: string;
    couponId?: string;
    pointsDeduct?: number;
    remark?: string;
    items: { skuId: string; quantity: number }[];
  }) {
    const address = await this.prisma.userAddress.findFirst({
      where: { id: BigInt(data.addressId), userId: BigInt(userId), deletedAt: null },
    });
    if (!address) throw new NotFoundException('收货地址不存在');

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
          status: 1,
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
    const freightAmount = this.calculateFreight(totalAmount, address.province);
    const payAmount = Math.max(0, totalAmount - discountAmount - couponAmount - activityDiscountAmount - pointsAmount + freightAmount);

    const order = await this.prisma.$transaction(async (tx) => {
      for (const check of skuStockChecks) {
        const updated = await tx.productSku.updateMany({
          where: { id: check.skuId, stock: { gte: check.quantity } },
          data: { stock: { decrement: check.quantity }, sales: { increment: check.quantity } },
        });
        if (updated.count === 0) {
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
            totalPoints: { decrement: pointsDeducted },
          },
        });
        await tx.pointsRecord.create({
          data: {
            userId: BigInt(userId),
            type: 2,
            points: -pointsDeducted,
            balance: user.availablePoints - pointsDeducted,
            source: 'order_deduct',
            description: `订单积分抵扣，扣除${pointsDeducted}积分`,
          },
        });
      }

      if (couponId) {
        await tx.userCoupon.update({
          where: { id: couponId },
          data: { status: 2 },
        });
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
          receiverName: address.receiverName,
          receiverPhone: address.receiverPhone,
          province: address.province,
          city: address.city,
          district: address.district,
          detailAddress: address.detailAddress,
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

    this.logger.log(`用户${userId}创建订单：${order.orderNo}，实付${payAmount}分`);
    return this.serializeOrder(order);
  }

  async cancel(userId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: BigInt(id), userId: BigInt(userId) },
      include: { orderItems: true },
    });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.status !== OrderStatus.pending_payment) {
      throw new BadRequestException('只能取消待付款订单');
    }

    const result = await this.prisma.$transaction(async (tx) => {
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
              totalPoints: { increment: order.pointsDeducted },
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
        await tx.userCoupon.update({
          where: { id: order.couponId },
          data: { status: 1 },
        });
      }

      return tx.order.update({
        where: { id: BigInt(id) },
        data: {
          status: OrderStatus.cancelled,
          cancelledAt: new Date(),
          cancelReason: '用户主动取消',
          orderLogs: {
            create: {
              operatorType: 'user',
              operatorId: BigInt(userId),
              action: 'cancel',
              content: '用户取消订单',
            },
          },
        },
      });
    });

    this.logger.log(`用户${userId}取消订单：${id}`);
    return this.serializeOrder(result);
  }

  async confirmReceive(userId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: BigInt(id), userId: BigInt(userId) },
      include: { orderItems: true, delivery: true },
    });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.status !== OrderStatus.delivered) {
      throw new BadRequestException('只能确认已发货订单');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const earnedPoints = Math.floor(order.payAmount! / 100);

      if (earnedPoints > 0) {
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

      if (order.delivery) {
        await tx.orderDelivery.update({
          where: { orderId: order.id },
          data: { receivedAt: new Date() },
        });
      }

      return tx.order.update({
        where: { id: BigInt(id) },
        data: {
          status: OrderStatus.completed,
          completedAt: new Date(),
          orderLogs: {
            create: {
              operatorType: 'user',
              operatorId: BigInt(userId),
              action: 'confirm_receive',
              content: '用户确认收货，发放积分' + earnedPoints,
            },
          },
        },
      });
    });

    this.logger.log(`用户${userId}确认收货：${id}`);
    return this.serializeOrder(result);
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
    return paginate(list.map((o) => this.serializeOrder(o)), total, dto.page, dto.pageSize);
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
    return this.serializeOrder(order);
  }

  async findAllAdmin(dto: OrderQueryDto) {
    const where: any = {};
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
        include: {
          orderItems: true,
          user: { select: { id: true, nickname: true, phone: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    this.logger.log(`管理员查询订单列表，共${total}条`);
    return paginate(list.map((o) => this.serializeOrder(o)), total, dto.page, dto.pageSize);
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
    return this.serializeOrder(order);
  }

  async adminCancel(id: string, reason: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: BigInt(id) },
      include: { orderItems: true },
    });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.status !== OrderStatus.pending_payment) {
      throw new BadRequestException('只能取消待付款订单');
    }

    const result = await this.prisma.$transaction(async (tx) => {
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
              totalPoints: { increment: order.pointsDeducted },
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
        await tx.userCoupon.update({
          where: { id: order.couponId },
          data: { status: 1 },
        });
      }

      return tx.order.update({
        where: { id: BigInt(id) },
        data: {
          status: OrderStatus.cancelled,
          cancelledAt: new Date(),
          cancelReason: reason || '管理员取消',
          orderLogs: {
            create: {
              operatorType: 'admin',
              action: 'cancel',
              content: `管理员取消订单，原因：${reason || '无'}`,
            },
          },
        },
      });
    });

    this.logger.log(`管理员取消订单：${id}，原因：${reason}`);
    return this.serializeOrder(result);
  }

  async findDeliveryList(dto: OrderQueryDto) {
    const where: any = { status: OrderStatus.pending_delivery };
    if (dto.orderNo) where.orderNo = { contains: dto.orderNo };

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
    if (order.status !== OrderStatus.pending_delivery) {
      throw new BadRequestException('只能发货待发货订单');
    }

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
    return this.serializeOrder(result);
  }

  async adminUpdateStatus(id: string, status: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: BigInt(id) },
    });
    if (!order) throw new NotFoundException('订单不存在');

    const result = await this.prisma.order.update({
      where: { id: BigInt(id) },
      data: {
        status: status as OrderStatus,
        orderLogs: {
          create: {
            operatorType: 'admin',
            action: 'update_status',
            content: `管理员更新订单状态为${status}`,
          },
        },
      },
    });

    this.logger.log(`管理员更新订单状态：${id} -> ${status}`);
    return this.serializeOrder(result);
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
    return this.serializeOrder(result);
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
        await this.prisma.$transaction(async (tx) => {
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
                  totalPoints: { increment: order.pointsDeducted },
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
            await tx.userCoupon.update({
              where: { id: order.couponId },
              data: { status: 1 },
            });
          }

          await tx.order.update({
            where: { id: order.id },
            data: {
              status: OrderStatus.cancelled,
              cancelledAt: new Date(),
              cancelReason: '超时未支付自动关闭',
              orderLogs: {
                create: {
                  operatorType: 'system',
                  action: 'auto_close',
                  content: '超时未支付，系统自动关闭订单',
                },
              },
            },
          });
        });

        closedCount++;
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
    });

    let completedCount = 0;
    for (const order of orders) {
      try {
        await this.prisma.order.update({
          where: { id: order.id },
          data: {
            status: OrderStatus.completed,
            completedAt: new Date(),
            orderLogs: {
              create: {
                operatorType: 'system',
                action: 'auto_complete',
                content: '超时未确认收货，系统自动完成',
              },
            },
          },
        });
        completedCount++;
      } catch (error) {
        this.logger.error(`自动完成订单${order.orderNo}失败：${(error as Error).message}`);
      }
    }

    this.logger.log(`自动完成超时订单，共${completedCount}条`);
    return { completedCount };
  }

  async exportOrders(dto: OrderQueryDto) {
    const where: any = {};
    if (dto.status) where.status = dto.status;
    if (dto.orderNo) where.orderNo = { contains: dto.orderNo };
    if (dto.startDate || dto.endDate) {
      where.createdAt = {};
      if (dto.startDate) where.createdAt.gte = new Date(dto.startDate);
      if (dto.endDate) where.createdAt.lte = new Date(dto.endDate);
    }

    const orders = await this.prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        orderItems: true,
        user: { select: { id: true, nickname: true, phone: true } },
      },
    });

    this.logger.log(`导出订单，共${orders.length}条`);
    return orders.map((o) => this.serializeOrder(o));
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

  private serializeOrder(order: any) {
    return {
      ...order,
      id: order.id.toString(),
      userId: order.userId?.toString(),
      couponId: order.couponId?.toString(),
      orderItems: order.orderItems?.map((i: any) => ({
        ...i,
        id: i.id.toString(),
        orderId: i.orderId.toString(),
        productId: i.productId.toString(),
        skuId: i.skuId.toString(),
        activityId: i.activityId?.toString(),
        supplierId: i.supplierId?.toString(),
      })),
      payment: order.payment
        ? {
            ...order.payment,
            id: order.payment.id.toString(),
            orderId: order.payment.orderId.toString(),
          }
        : null,
      delivery: order.delivery
        ? {
            ...order.delivery,
            id: order.delivery.id.toString(),
            orderId: order.delivery.orderId.toString(),
          }
        : null,
      orderLogs: order.orderLogs?.map((l: any) => ({
        ...l,
        id: l.id.toString(),
        orderId: l.orderId.toString(),
        operatorId: l.operatorId?.toString(),
      })),
      user: order.user
        ? { ...order.user, id: order.user.id.toString() }
        : null,
    };
  }
}
