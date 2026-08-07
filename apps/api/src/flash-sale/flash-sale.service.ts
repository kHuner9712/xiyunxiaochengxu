import {
  Injectable,
  Inject,
  forwardRef,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { OrderStatus, Prisma } from '@prisma/client';
import { paginate } from '@baby-mall/shared';
import { OrderService } from '../order/order.service';
import {
  FlashSaleActivityQueryDto,
  FlashSaleActivityDto,
  FlashSaleActivityStatusDto,
  FlashSaleOrderQueryDto,
  FlashSaleBuyDto,
} from './dto/flash-sale.dto';

const MAX_SIGNED_BIGINT = 9223372036854775807n;
const POSITIVE_ID_PATTERN = /^[1-9]\d*$/;

@Injectable()
export class FlashSaleService {
  private readonly logger = new Logger(FlashSaleService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => OrderService))
    private orderService: OrderService,
  ) {}

  private parsePositiveId(value: string | bigint, label: string): bigint {
    const normalized = String(value ?? '').trim();
    if (!POSITIVE_ID_PATTERN.test(normalized)) {
      throw new BadRequestException(`${label}ID无效`);
    }
    const parsed = BigInt(normalized);
    if (parsed > MAX_SIGNED_BIGINT) {
      throw new BadRequestException(`${label}ID超出范围`);
    }
    return parsed;
  }

  private async releaseActivityLock(activityId: bigint, quantity: number): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE flash_sale_activities
      SET locked_count = GREATEST(locked_count - ${quantity}, 0),
          updated_at = NOW(3)
      WHERE id = ${activityId}
    `;
  }

  // ============ 后台：活动管理 ============

  async findActivities(query: FlashSaleActivityQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const where: Prisma.FlashSaleActivityWhereInput = { deletedAt: null };
    if (query.keyword) {
      where.name = { contains: query.keyword };
    }
    if (query.status !== undefined && query.status !== null) {
      where.status = query.status;
    }
    if (query.productId) {
      where.productId = this.parsePositiveId(query.productId, '商品');
    }
    const [list, total] = await Promise.all([
      this.prisma.flashSaleActivity.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.flashSaleActivity.count({ where }),
    ]);
    return paginate(list, total, page, pageSize);
  }

  async findActivityById(id: string) {
    const activityId = this.parsePositiveId(id, '活动');
    const activity = await this.prisma.flashSaleActivity.findFirst({
      where: { id: activityId, deletedAt: null },
    });
    if (!activity) throw new NotFoundException('活动不存在');
    return activity;
  }

  async createActivity(dto: FlashSaleActivityDto) {
    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);
    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      throw new BadRequestException('时间格式错误');
    }
    if (endTime <= startTime) {
      throw new BadRequestException('结束时间必须晚于开始时间');
    }
    return this.prisma.flashSaleActivity.create({
      data: {
        name: dto.name,
        productId: this.parsePositiveId(dto.productId, '商品'),
        skuId: dto.skuId ? this.parsePositiveId(dto.skuId, 'SKU ') : null,
        flashPrice: dto.flashPrice,
        originalPrice: dto.originalPrice ?? null,
        stockLimit: dto.stockLimit,
        limitPerUser: dto.limitPerUser ?? 1,
        lockMinutes: dto.lockMinutes ?? 15,
        startTime,
        endTime,
        status: dto.status ?? 1,
        sortOrder: dto.sortOrder ?? 0,
        description: dto.description ?? null,
        coverImage: dto.coverImage ?? null,
      },
    });
  }

  async updateActivity(id: string, dto: FlashSaleActivityDto) {
    const activity = await this.findActivityById(id);
    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);
    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      throw new BadRequestException('时间格式错误');
    }
    if (endTime <= startTime) {
      throw new BadRequestException('结束时间必须晚于开始时间');
    }
    return this.prisma.flashSaleActivity.update({
      where: { id: activity.id },
      data: {
        name: dto.name,
        productId: this.parsePositiveId(dto.productId, '商品'),
        skuId: dto.skuId ? this.parsePositiveId(dto.skuId, 'SKU ') : null,
        flashPrice: dto.flashPrice,
        originalPrice: dto.originalPrice ?? null,
        stockLimit: dto.stockLimit,
        limitPerUser: dto.limitPerUser ?? 1,
        lockMinutes: dto.lockMinutes ?? 15,
        startTime,
        endTime,
        status: dto.status ?? activity.status,
        sortOrder: dto.sortOrder ?? 0,
        description: dto.description ?? null,
        coverImage: dto.coverImage ?? null,
      },
    });
  }

  async updateActivityStatus(id: string, dto: FlashSaleActivityStatusDto) {
    const activity = await this.findActivityById(id);
    return this.prisma.flashSaleActivity.update({
      where: { id: activity.id },
      data: { status: dto.status },
    });
  }

  async deleteActivity(id: string) {
    const activity = await this.findActivityById(id);
    return this.prisma.flashSaleActivity.update({
      where: { id: activity.id },
      data: { deletedAt: new Date(), status: 0 },
    });
  }

  // ============ 后台：秒杀订单与统计 ============

  async findOrders(query: FlashSaleOrderQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const where: Prisma.FlashSaleOrderWhereInput = { deletedAt: null };
    if (query.activityId) where.activityId = this.parsePositiveId(query.activityId, '活动');
    if (query.status) where.status = query.status;
    if (query.userId) where.userId = this.parsePositiveId(query.userId, '用户');
    if (query.orderId) where.orderId = this.parsePositiveId(query.orderId, '订单');
    if (query.startTime || query.endTime) {
      where.createdAt = {};
      if (query.startTime) where.createdAt.gte = new Date(query.startTime);
      if (query.endTime) where.createdAt.lte = new Date(query.endTime);
    }
    const [list, total] = await Promise.all([
      this.prisma.flashSaleOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.flashSaleOrder.count({ where }),
    ]);
    return paginate(list, total, page, pageSize);
  }

  async findOrderById(id: string) {
    const orderId = this.parsePositiveId(id, '秒杀订单');
    const order = await this.prisma.flashSaleOrder.findFirst({
      where: { id: orderId, deletedAt: null },
    });
    if (!order) throw new NotFoundException('秒杀订单不存在');
    return order;
  }

  async getStats() {
    const [activityCount, orderCount, pendingCount, paidCount, cancelledCount, expiredCount, paidAgg] =
      await Promise.all([
        this.prisma.flashSaleActivity.count({ where: { deletedAt: null } }),
        this.prisma.flashSaleOrder.count({ where: { deletedAt: null } }),
        this.prisma.flashSaleOrder.count({ where: { deletedAt: null, status: 'pending_payment' } }),
        this.prisma.flashSaleOrder.count({ where: { deletedAt: null, status: 'paid' } }),
        this.prisma.flashSaleOrder.count({ where: { deletedAt: null, status: 'cancelled' } }),
        this.prisma.flashSaleOrder.count({ where: { deletedAt: null, status: 'expired' } }),
        this.prisma.flashSaleOrder.aggregate({
          where: { deletedAt: null, status: 'paid' },
          _sum: { flashPrice: true },
        }),
      ]);
    return {
      activityCount,
      orderCount,
      pendingCount,
      paidCount,
      cancelledCount,
      expiredCount,
      paidAmount: paidAgg._sum.flashPrice ?? 0,
    };
  }

  async releaseExpiredLocks() {
    const now = new Date();
    const expired = await this.prisma.flashSaleOrder.findMany({
      where: { status: 'pending_payment', lockExpireAt: { lt: now }, deletedAt: null },
      take: 200,
    });
    let released = 0;
    let deferred = 0;
    let settled = 0;
    let failed = 0;

    for (const fsOrder of expired) {
      try {
        const sourceOrder = await this.prisma.order.findFirst({
          where: { id: fsOrder.orderId },
          select: { status: true },
        });

        // Never release a flash-sale lock while the underlying order is still payable.
        // The regular order timeout task performs payment reconciliation before it closes orders.
        if (sourceOrder?.status === OrderStatus.pending_payment) {
          deferred++;
          continue;
        }

        // A non-cancelled order has already crossed the payment boundary. Keep the reserved
        // inventory and repair the flash-sale side instead of releasing it back to the pool.
        if (sourceOrder && sourceOrder.status !== OrderStatus.cancelled) {
          await this.handlePaymentSuccess(fsOrder.orderId);
          settled++;
          continue;
        }

        const didRelease = await this.prisma.$transaction(async (tx) => {
          const result = await tx.flashSaleOrder.updateMany({
            where: { id: fsOrder.id, status: 'pending_payment' },
            data: { status: 'expired', expiredAt: now },
          });
          if (result.count === 0) return false;

          await tx.$executeRaw`
            UPDATE flash_sale_activities
            SET locked_count = GREATEST(locked_count - ${fsOrder.quantity}, 0),
                updated_at = NOW(3)
            WHERE id = ${fsOrder.activityId}
          `;
          return true;
        });

        if (didRelease) released++;
      } catch (error) {
        failed++;
        this.logger.error(
          `释放秒杀库存锁失败: fsOrderId=${fsOrder.id}, orderId=${fsOrder.orderId}, error=${(error as Error).message}`,
        );
      }
    }

    this.logger.log(
      `秒杀过期锁处理完成: released=${released}, deferred=${deferred}, settled=${settled}, failed=${failed}`,
    );
    return { released, deferred, settled, failed };
  }

  // ============ 小程序：列表/详情/下单/我的订单 ============

  async weappFindActivities(query: { page?: number; pageSize?: number }) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const now = new Date();
    const where: Prisma.FlashSaleActivityWhereInput = {
      deletedAt: null,
      status: 1,
    };
    const [list, total] = await Promise.all([
      this.prisma.flashSaleActivity.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { startTime: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.flashSaleActivity.count({ where }),
    ]);
    return paginate(
      list.map((a) => ({ ...a, now: now.toISOString() })),
      total,
      page,
      pageSize,
    );
  }

  async weappFindActivityById(id: string) {
    const activityId = this.parsePositiveId(id, '活动');
    const activity = await this.prisma.flashSaleActivity.findFirst({
      where: { id: activityId, deletedAt: null },
    });
    if (!activity) throw new NotFoundException('活动不存在');
    return { ...activity, now: new Date().toISOString() };
  }

  async weappBuy(userId: string, dto: FlashSaleBuyDto) {
    const activityId = this.parsePositiveId(dto.activityId, '活动');
    const buyerUserId = this.parsePositiveId(userId, '用户');
    const activity = await this.prisma.flashSaleActivity.findFirst({
      where: { id: activityId, deletedAt: null },
    });
    if (!activity) throw new NotFoundException('活动不存在');
    if (activity.status !== 1) throw new BadRequestException('活动已下架');
    const now = new Date();
    if (now < activity.startTime) throw new BadRequestException('活动未开始');
    if (now >= activity.endTime) throw new BadRequestException('活动已结束');

    const quantity = dto.quantity ?? 1;
    if (quantity <= 0) throw new BadRequestException('数量必须大于 0');

    // 限购校验：统计 pending_payment + paid
    if (activity.limitPerUser > 0) {
      const bought = await this.prisma.flashSaleOrder.aggregate({
        where: {
          activityId: activity.id,
          userId: buyerUserId,
          status: { in: ['pending_payment', 'paid'] },
          deletedAt: null,
        },
        _sum: { quantity: true },
      });
      const already = bought._sum.quantity ?? 0;
      if (already + quantity > activity.limitPerUser) {
        throw new BadRequestException(`每人限购 ${activity.limitPerUser} 件`);
      }
    }

    // 确定下单 SKU
    const skuId = activity.skuId;
    if (!skuId) throw new BadRequestException('该活动未指定规格，请联系客服');

    const lockExpireAt = new Date(now.getTime() + activity.lockMinutes * 60 * 1000);

    // 原子锁库存：locked_count += quantity，条件 stock_limit - sold_count - locked_count >= quantity
    const locked = await this.prisma.$executeRaw`
      UPDATE flash_sale_activities
      SET locked_count = locked_count + ${quantity},
          updated_at = NOW(3)
      WHERE id = ${activity.id}
        AND status = 1
        AND deleted_at IS NULL
        AND stock_limit - sold_count - locked_count >= ${quantity}
    `;
    if (locked === 0) {
      throw new BadRequestException('秒杀库存不足');
    }

    let orderId: bigint | null = null;
    let orderItemId: bigint | null = null;
    let fsOrder: any = null;
    let underlyingOrderCancelled = false;

    try {
      const order = await this.orderService.create(userId, {
        items: [{ skuId: skuId.toString(), quantity, priceOverride: activity.flashPrice }],
        addressId: dto.addressId,
        pickupStoreId: dto.pickupStoreId,
        fulfillmentType: dto.fulfillmentType,
        couponId: dto.couponId,
        pointsDeduct: dto.pointsDeduct,
        sourceType: dto.sourceType,
        sourceCode: dto.sourceCode,
        referrerUserId: dto.referrerUserId,
        remark: dto.remark,
      });
      orderId = this.parsePositiveId(order.orderId, '订单');

      // The flash-sale lock is the payment deadline. Keep the ordinary order's auto-close
      // deadline aligned so the lock is never released while that order remains payable.
      if (!order.isZeroPay) {
        const aligned = await this.prisma.order.updateMany({
          where: {
            id: orderId,
            userId: buyerUserId,
            status: OrderStatus.pending_payment,
          },
          data: { autoCloseAt: lockExpireAt },
        });
        if (aligned.count === 0) {
          throw new BadRequestException('秒杀订单状态异常，请重新下单');
        }
      }

      if ((order as any).orderItemId) {
        orderItemId = this.parsePositiveId((order as any).orderItemId, '订单明细');
      }

      fsOrder = await this.prisma.flashSaleOrder.create({
        data: {
          activityId: activity.id,
          userId: buyerUserId,
          orderId,
          orderItemId,
          quantity,
          flashPrice: activity.flashPrice,
          status: 'pending_payment',
          lockExpireAt,
        },
      });

      // Zero-pay orders have already crossed the payment boundary inside OrderService.
      // Settle the flash-sale counters immediately; a later scheduler pass remains a fallback.
      if (order.isZeroPay) {
        try {
          await this.handlePaymentSuccess(orderId);
        } catch (error) {
          this.logger.error(
            `零元秒杀订单成交同步失败，将由过期锁任务继续修复: orderId=${orderId}, error=${(error as Error).message}`,
          );
        }
      }
    } catch (err) {
      if (orderId) {
        try {
          await this.orderService.cancel(userId, orderId.toString());
          underlyingOrderCancelled = true;
        } catch (cancelError) {
          this.logger.error(
            `秒杀下单回滚普通订单失败，保留库存锁避免超卖: orderId=${orderId}, error=${(cancelError as Error).message}`,
          );
        }
      }

      // Before a flash_sale_order record exists, OrderService.cancel has no flash lock record
      // to release through the cancellation hook. Release manually only when the ordinary
      // order either never existed or was confirmed cancelled.
      if (!fsOrder && (!orderId || underlyingOrderCancelled)) {
        await this.releaseActivityLock(activity.id, quantity);
      }
      throw err;
    }

    return {
      flashSaleOrderId: fsOrder.id.toString(),
      orderId: orderId!.toString(),
      flashPrice: activity.flashPrice,
      quantity,
      lockExpireAt: lockExpireAt.toISOString(),
    };
  }

  async weappFindMyOrders(userId: string, query: { page?: number; pageSize?: number }) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const where: Prisma.FlashSaleOrderWhereInput = {
      userId: this.parsePositiveId(userId, '用户'),
      deletedAt: null,
    };
    const [list, total] = await Promise.all([
      this.prisma.flashSaleOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.flashSaleOrder.count({ where }),
    ]);
    return paginate(list, total, page, pageSize);
  }

  // ============ 支付成功后成交逻辑（payment.service 挂接） ============

  async handlePaymentSuccess(orderId: bigint | string): Promise<void> {
    const normalizedOrderId = this.parsePositiveId(orderId, '订单');
    const fsOrder = await this.prisma.flashSaleOrder.findFirst({
      where: { orderId: normalizedOrderId, deletedAt: null },
    });
    if (!fsOrder) {
      // 非秒杀订单，忽略
      return;
    }
    if (fsOrder.status === 'paid') {
      // 幂等：已支付，跳过
      this.logger.debug(`秒杀订单已支付，幂等跳过: orderId=${orderId}`);
      return;
    }
    if (fsOrder.status !== 'pending_payment') {
      this.logger.warn(
        `秒杀订单状态为 ${fsOrder.status}，支付成功未计入成交: orderId=${orderId}, fsOrderId=${fsOrder.id}`,
      );
      return;
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.flashSaleOrder.updateMany({
        where: { id: fsOrder.id, status: 'pending_payment' },
        data: { status: 'paid', paidAt: now },
      });
      if (result.count === 0) return;
      // locked_count -= quantity, sold_count += quantity
      await tx.$executeRaw`
        UPDATE flash_sale_activities
        SET locked_count = GREATEST(locked_count - ${fsOrder.quantity}, 0),
            sold_count = sold_count + ${fsOrder.quantity},
            updated_at = NOW(3)
        WHERE id = ${fsOrder.activityId}
      `;
    });
  }

  // ============ 订单取消释放锁（order.service cancel 挂接） ============

  async handleOrderCancel(orderId: bigint | string): Promise<void> {
    const normalizedOrderId = this.parsePositiveId(orderId, '订单');
    const fsOrder = await this.prisma.flashSaleOrder.findFirst({
      where: { orderId: normalizedOrderId, deletedAt: null },
    });
    if (!fsOrder) return;
    if (fsOrder.status !== 'pending_payment') return;

    const now = new Date();
    const released = await this.prisma.$transaction(async (tx) => {
      const result = await tx.flashSaleOrder.updateMany({
        where: { id: fsOrder.id, status: 'pending_payment' },
        data: { status: 'cancelled', cancelledAt: now },
      });
      if (result.count === 0) return false;

      await tx.$executeRaw`
        UPDATE flash_sale_activities
        SET locked_count = GREATEST(locked_count - ${fsOrder.quantity}, 0),
            updated_at = NOW(3)
        WHERE id = ${fsOrder.activityId}
      `;
      return true;
    });

    if (released) {
      this.logger.log(`秒杀订单取消，释放库存锁: orderId=${orderId}, quantity=${fsOrder.quantity}`);
    }
  }
}
