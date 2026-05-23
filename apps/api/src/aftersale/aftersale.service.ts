import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateAftersaleDto } from './dto/create-aftersale.dto';
import { ReturnLogisticsDto } from './dto/return-logistics.dto';
import { generateAftersaleNo, paginate, AFTERSALE_APPLY_DAYS } from '@baby-mall/shared';
import { AftersaleStatus, OrderStatus } from '@prisma/client';
import { PaymentService } from '../payment/payment.service';

@Injectable()
export class AftersaleService {
  private readonly logger = new Logger(AftersaleService.name);

  constructor(private prisma: PrismaService, private paymentService: PaymentService) {}

  async create(userId: string, dto: CreateAftersaleDto) {
    const orderItem = await this.prisma.orderItem.findFirst({
      where: { id: BigInt(dto.orderItemId) },
      include: { order: true },
    });
    if (!orderItem) throw new NotFoundException('订单商品不存在');
    if (orderItem.order.userId !== BigInt(userId)) throw new BadRequestException('无权操作');

    if (orderItem.order.status !== OrderStatus.delivered && orderItem.order.status !== OrderStatus.completed) {
      throw new BadRequestException('订单状态不允许申请售后');
    }

    if (orderItem.order.status === OrderStatus.completed && orderItem.order.completedAt) {
      const daysSinceComplete = Math.floor((Date.now() - orderItem.order.completedAt.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceComplete > AFTERSALE_APPLY_DAYS) {
        throw new BadRequestException(`确认收货${AFTERSALE_APPLY_DAYS}天后无法申请售后`);
      }
    }

    if (dto.type !== 1 && dto.type !== 2) {
      throw new BadRequestException('售后类型只能为1(仅退款)或2(退货退款)');
    }

    try {
      const aftersale = await this.prisma.$transaction(async (tx) => {
        const created = await tx.aftersaleOrder.create({
          data: {
            aftersaleNo: generateAftersaleNo(),
            orderId: orderItem.orderId,
            orderItemId: BigInt(dto.orderItemId),
            userId: BigInt(userId),
            type: dto.type,
            reason: dto.reason,
            description: dto.description,
            images: dto.images,
            status: AftersaleStatus.pending_review,
            activeOrderItemId: BigInt(dto.orderItemId),
            aftersaleLogs: {
              create: {
                operatorType: 'user',
                operatorId: BigInt(userId),
                action: 'apply',
                content: `用户申请售后，类型：${dto.type === 1 ? '仅退款' : '退货退款'}，原因：${dto.reason}`,
              },
            },
          },
        });

        await tx.order.update({
          where: { id: orderItem.orderId },
          data: { status: OrderStatus.aftersale },
        });

        return created;
      });

      this.logger.log(`用户${userId}申请售后：${aftersale.aftersaleNo}，类型${dto.type}`);
      return this.serializeAftersale(aftersale);
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new BadRequestException('该商品已申请售后');
      }
      throw error;
    }
  }

  async findByUser(userId: string, dto: { skip?: number; take?: number; page?: number; pageSize?: number }) {
    const where = { userId: BigInt(userId) };
    const [list, total] = await Promise.all([
      this.prisma.aftersaleOrder.findMany({
        where,
        skip: dto.skip,
        take: dto.take,
        orderBy: { createdAt: 'desc' },
        include: { orderItem: true },
      }),
      this.prisma.aftersaleOrder.count({ where }),
    ]);

    this.logger.log(`用户${userId}查询售后列表，共${total}条`);
    return paginate(list.map((a) => this.serializeAftersale(a)), total, dto.page ?? 1, dto.pageSize ?? 10);
  }

  async findUserDetail(userId: string, id: string) {
    const aftersale = await this.prisma.aftersaleOrder.findFirst({
      where: { id: BigInt(id), userId: BigInt(userId) },
      include: {
        orderItem: true,
        order: true,
        aftersaleLogs: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!aftersale) throw new NotFoundException('售后单不存在');
    return this.serializeAftersale(aftersale);
  }

  async fillReturnLogistics(userId: string, id: string, dto: ReturnLogisticsDto) {
    const aftersale = await this.prisma.aftersaleOrder.findFirst({
      where: { id: BigInt(id), userId: BigInt(userId) },
    });
    if (!aftersale) throw new NotFoundException('售后单不存在');
    if (aftersale.status !== AftersaleStatus.approved) {
      throw new BadRequestException('当前状态不允许填写退货物流');
    }
    if (aftersale.type !== 2) {
      throw new BadRequestException('仅退款类型不需要填写退货物流');
    }

    const result = await this.prisma.aftersaleOrder.update({
      where: { id: BigInt(id) },
      data: {
        status: AftersaleStatus.returned,
        returnLogisticsCompany: dto.returnLogisticsCompany,
        returnLogisticsNo: dto.returnLogisticsNo,
        aftersaleLogs: {
          create: {
            operatorType: 'user',
            operatorId: BigInt(userId),
            action: 'fill_return_logistics',
            content: `用户填写退货物流，${dto.returnLogisticsCompany}：${dto.returnLogisticsNo}`,
          },
        },
      },
    });

    this.logger.log(`用户${userId}填写退货物流：${id}，${dto.returnLogisticsCompany} ${dto.returnLogisticsNo}`);
    return this.serializeAftersale(result);
  }

  async cancel(userId: string, id: string) {
    const aftersale = await this.prisma.aftersaleOrder.findFirst({
      where: { id: BigInt(id), userId: BigInt(userId) },
      include: { order: true },
    });
    if (!aftersale) throw new NotFoundException('售后单不存在');
    if (aftersale.status !== AftersaleStatus.pending_review) {
      throw new BadRequestException('只能取消待审核的售后申请');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.aftersaleOrder.update({
        where: { id: BigInt(id) },
        data: {
          status: AftersaleStatus.closed,
          activeOrderItemId: null,
          aftersaleLogs: {
            create: {
              operatorType: 'user',
              operatorId: BigInt(userId),
              action: 'cancel',
              content: '用户取消售后申请',
            },
          },
        },
      });

      const otherAftersales = await tx.aftersaleOrder.findFirst({
        where: {
          orderId: aftersale.orderId,
          id: { not: BigInt(id) },
          status: { notIn: [AftersaleStatus.closed, AftersaleStatus.rejected, AftersaleStatus.refunded] },
        },
      });
      if (!otherAftersales) {
        const restoreStatus = aftersale.order.completedAt ? OrderStatus.completed : OrderStatus.delivered;
        await tx.order.update({
          where: { id: aftersale.orderId },
          data: { status: restoreStatus },
        });
      }

      return updated;
    });

    this.logger.log(`用户${userId}取消售后：${id}`);
    return this.serializeAftersale(result);
  }

  async findAllAdmin(dto: { skip?: number; take?: number; page?: number; pageSize?: number; status?: string }) {
    const where: any = {};
    if (dto.status) where.status = dto.status;
    const [list, total] = await Promise.all([
      this.prisma.aftersaleOrder.findMany({
        where,
        skip: dto.skip,
        take: dto.take,
        orderBy: { createdAt: 'desc' },
        include: {
          order: true,
          orderItem: true,
          user: { select: { id: true, nickname: true, phone: true } },
        },
      }),
      this.prisma.aftersaleOrder.count({ where }),
    ]);

    this.logger.log(`管理员查询售后列表，共${total}条`);
    return paginate(list.map((a) => this.serializeAftersale(a)), total, dto.page ?? 1, dto.pageSize ?? 10);
  }

  async findAdminDetail(id: string) {
    const aftersale = await this.prisma.aftersaleOrder.findFirst({
      where: { id: BigInt(id) },
      include: {
        order: true,
        orderItem: true,
        user: { select: { id: true, nickname: true, phone: true } },
        aftersaleLogs: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!aftersale) throw new NotFoundException('售后单不存在');
    return this.serializeAftersale(aftersale);
  }

  async approve(id: string, adminId: string, refundAmount: number) {
    const aftersale = await this.prisma.aftersaleOrder.findFirst({
      where: { id: BigInt(id) },
      include: { orderItem: true },
    });
    if (!aftersale) throw new NotFoundException('售后单不存在');
    if (aftersale.status !== AftersaleStatus.pending_review) {
      throw new BadRequestException('当前状态不允许审核');
    }

    if (refundAmount > aftersale.orderItem.subtotal) {
      throw new BadRequestException('退款金额不能超过商品实付金额');
    }

    const result = await this.prisma.aftersaleOrder.update({
      where: { id: BigInt(id) },
      data: {
        status: aftersale.type === 1 ? AftersaleStatus.approved : AftersaleStatus.approved,
        refundAmount,
        adminId: BigInt(adminId),
        reviewedAt: new Date(),
        aftersaleLogs: {
          create: {
            operatorType: 'admin',
            operatorId: BigInt(adminId),
            action: 'approve',
            content: `管理员同意售后，退款金额：${refundAmount}分`,
          },
        },
      },
    });

    this.logger.log(`管理员同意售后：${id}，退款${refundAmount}分`);
    return this.serializeAftersale(result);
  }

  async reject(id: string, adminId: string, rejectReason: string) {
    const aftersale = await this.prisma.aftersaleOrder.findFirst({
      where: { id: BigInt(id) },
      include: { order: true },
    });
    if (!aftersale) throw new NotFoundException('售后单不存在');
    if (aftersale.status !== AftersaleStatus.pending_review) {
      throw new BadRequestException('当前状态不允许拒绝');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.aftersaleOrder.update({
        where: { id: BigInt(id) },
        data: {
          status: AftersaleStatus.rejected,
          rejectReason,
          adminId: BigInt(adminId),
          reviewedAt: new Date(),
          activeOrderItemId: null,
          aftersaleLogs: {
            create: {
              operatorType: 'admin',
              operatorId: BigInt(adminId),
              action: 'reject',
              content: `管理员拒绝售后：${rejectReason}`,
            },
          },
        },
      });

      const otherAftersales = await tx.aftersaleOrder.findFirst({
        where: {
          orderId: aftersale.orderId,
          id: { not: BigInt(id) },
          status: { notIn: [AftersaleStatus.closed, AftersaleStatus.rejected, AftersaleStatus.refunded] },
        },
      });
      if (!otherAftersales) {
        const restoreStatus = aftersale.order.completedAt ? OrderStatus.completed : OrderStatus.delivered;
        await tx.order.update({
          where: { id: aftersale.orderId },
          data: { status: restoreStatus },
        });
      }

      return updated;
    });

    this.logger.log(`管理员拒绝售后：${id}，原因：${rejectReason}`);
    return this.serializeAftersale(result);
  }

  async refund(id: string, adminId: string) {
    const aftersale = await this.prisma.aftersaleOrder.findFirst({
      where: { id: BigInt(id) },
      include: { order: true, orderItem: true },
    });
    if (!aftersale) throw new NotFoundException('售后单不存在');

    if (aftersale.status === AftersaleStatus.pending_refund || aftersale.status === AftersaleStatus.refunded) {
      throw new BadRequestException('退款已在处理中或已完成');
    }

    if (aftersale.type === 1 && aftersale.status !== AftersaleStatus.approved) {
      throw new BadRequestException('仅退款类型需审核通过后才能退款');
    }
    if (aftersale.type === 2 && aftersale.status !== AftersaleStatus.returned) {
      throw new BadRequestException('退货退款类型需用户填写退货物流后才能退款');
    }
    if (!aftersale.refundAmount) {
      throw new BadRequestException('退款金额未设置');
    }

    try {
      await this.paymentService.createRefund({
        orderId: aftersale.orderId.toString(),
        aftersaleId: id,
        refundAmount: aftersale.refundAmount,
        reason: aftersale.reason,
      });
    } catch (error) {
      this.logger.error(`发起退款失败，售后单${id}保持原状态: ${(error as Error).message}`);
      await this.prisma.aftersaleLog.create({
        data: {
          aftersaleId: BigInt(id),
          operatorType: 'admin',
          operatorId: BigInt(adminId),
          action: 'refund_failed',
          content: `发起退款失败: ${(error as Error).message}，售后单保持原状态`,
        },
      });
      throw error;
    }

    const result = await this.prisma.aftersaleOrder.findFirst({ where: { id: BigInt(id) } });

    this.logger.log(`管理员发起退款：${id}，金额${aftersale.refundAmount}分`);
    return this.serializeAftersale(result);
  }

  private serializeAftersale(aftersale: any) {
    return {
      ...aftersale,
      id: aftersale.id.toString(),
      orderId: aftersale.orderId?.toString(),
      orderItemId: aftersale.orderItemId?.toString(),
      userId: aftersale.userId?.toString(),
      adminId: aftersale.adminId?.toString(),
      order: aftersale.order
        ? { ...aftersale.order, id: aftersale.order.id.toString(), userId: aftersale.order.userId?.toString() }
        : null,
      orderItem: aftersale.orderItem
        ? {
            ...aftersale.orderItem,
            id: aftersale.orderItem.id.toString(),
            orderId: aftersale.orderItem.orderId?.toString(),
            productId: aftersale.orderItem.productId.toString(),
            skuId: aftersale.orderItem.skuId.toString(),
          }
        : null,
      user: aftersale.user
        ? { ...aftersale.user, id: aftersale.user.id.toString() }
        : null,
      aftersaleLogs: aftersale.aftersaleLogs?.map((l: any) => ({
        ...l,
        id: l.id.toString(),
        aftersaleId: l.aftersaleId?.toString(),
        operatorId: l.operatorId?.toString(),
      })),
    };
  }
}
