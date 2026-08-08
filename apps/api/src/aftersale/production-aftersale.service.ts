import { BadRequestException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { AftersaleStatus, OrderStatus } from '@prisma/client';
import { AFTERSALE_APPLY_DAYS, generateAftersaleNo } from '@baby-mall/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { calculateOrderItemRefundCap } from '../common/utils/refund-amount';
import { PaymentService } from '../payment/payment.service';
import { SystemConfigService } from '../system-config/system-config.service';
import { AftersaleService } from './aftersale.service';
import { CreateAftersaleDto } from './dto/create-aftersale.dto';

@Injectable()
export class ProductionAftersaleService extends AftersaleService {
  private readonly productionLogger = new Logger(ProductionAftersaleService.name);

  constructor(
    private readonly productionPrisma: PrismaService,
    private readonly productionPaymentService: PaymentService,
    @Optional() private readonly systemConfigService?: SystemConfigService,
  ) {
    super(productionPrisma, productionPaymentService);
  }

  override async create(userId: string, dto: CreateAftersaleDto) {
    const userIdValue = parsePositiveBigIntId(userId, '用户');
    const orderId = parsePositiveBigIntId(dto.orderId, '订单');
    const orderItemId = parsePositiveBigIntId(dto.orderItemId, '订单商品');
    const orderItem = await this.productionPrisma.orderItem.findFirst({
      where: { id: orderItemId },
      include: { order: true },
    });
    if (!orderItem) throw new NotFoundException('订单商品不存在');
    if (orderItem.order.userId !== userIdValue) throw new BadRequestException('无权操作');
    if (orderItem.orderId !== orderId) throw new BadRequestException('订单商品不属于当前订单');

    const aftersaleAllowedStatuses: OrderStatus[] = [
      OrderStatus.delivered,
      OrderStatus.completed,
      OrderStatus.aftersale,
    ];
    if (!aftersaleAllowedStatuses.includes(orderItem.order.status)) {
      throw new BadRequestException('订单状态不允许申请售后');
    }

    const applyDays = this.systemConfigService?.getRuntimeConfig().aftersaleApplyDays ?? AFTERSALE_APPLY_DAYS;
    const referenceTime = orderItem.order.completedAt || orderItem.order.deliveredAt;
    if (referenceTime) {
      const elapsedMs = Date.now() - referenceTime.getTime();
      if (elapsedMs > applyDays * 24 * 60 * 60 * 1000) {
        throw new BadRequestException(`收货/发货${applyDays}天后无法申请售后`);
      }
    }

    if (dto.type !== 1 && dto.type !== 2) {
      throw new BadRequestException('售后类型只能为1(仅退款)或2(退货退款)');
    }

    try {
      const aftersale = await this.productionPrisma.$transaction(async (tx) => {
        const created = await tx.aftersaleOrder.create({
          data: {
            aftersaleNo: generateAftersaleNo(),
            orderId,
            orderItemId,
            userId: userIdValue,
            type: dto.type,
            reason: dto.reason,
            description: dto.description,
            images: dto.images,
            status: AftersaleStatus.pending_review,
            activeOrderItemId: orderItemId,
            aftersaleLogs: {
              create: {
                operatorType: 'user',
                operatorId: userIdValue,
                action: 'apply',
                content: `用户申请售后，类型：${dto.type === 1 ? '仅退款' : '退货退款'}，原因：${dto.reason}`,
              },
            },
          },
        });
        await tx.order.update({
          where: { id: orderId },
          data: { status: OrderStatus.aftersale },
        });
        return created;
      });

      this.productionLogger.log(`用户${userIdValue}申请售后：${aftersale.aftersaleNo}，类型${dto.type}`);
      return this.findUserDetail(userIdValue.toString(), aftersale.id.toString());
    } catch (error: any) {
      if (error?.code === 'P2002') throw new BadRequestException('该商品已申请售后');
      throw error;
    }
  }

  override async approve(id: string, adminId: string, refundAmount: number) {
    const aftersaleId = parsePositiveBigIntId(id, '售后单');
    const adminIdValue = parsePositiveBigIntId(adminId, '管理员');
    const aftersale = await this.productionPrisma.aftersaleOrder.findFirst({
      where: { id: aftersaleId },
      include: {
        orderItem: true,
        order: {
          include: {
            orderItems: true,
            orderRefunds: true,
            aftersaleOrders: true,
          },
        },
      },
    });
    if (!aftersale) throw new NotFoundException('售后单不存在');

    if ((aftersale.order.payAmount ?? 0) === 0) {
      if (!Number.isSafeInteger(refundAmount) || refundAmount !== 0) {
        throw new BadRequestException('0元订单退款金额必须为0分');
      }
      if (aftersale.status !== AftersaleStatus.pending_review) {
        throw new BadRequestException('售后单状态不允许审核');
      }
      if (aftersale.type === 2) {
        const refundCap = calculateOrderItemRefundCap(
          aftersale.order,
          aftersale.orderItem,
          aftersale.id,
        );
        if (refundCap.remainingAmount !== 0) {
          throw new BadRequestException('0元订单退货退款金额分配异常，请先核对订单金额');
        }
      }

      await this.productionPrisma.$transaction(async (tx) => {
        const claimed = await tx.aftersaleOrder.updateMany({
          where: { id: aftersaleId, status: AftersaleStatus.pending_review },
          data: {
            status: AftersaleStatus.approved,
            refundAmount: 0,
            adminId: adminIdValue,
            reviewedAt: new Date(),
          },
        });
        if (claimed.count !== 1) throw new BadRequestException('售后单状态已变化，请刷新后重试');
        await tx.aftersaleLog.create({
          data: {
            aftersaleId,
            operatorType: 'admin',
            operatorId: adminIdValue,
            action: 'approve',
            content: '管理员审核通过，0元订单退款金额：0分',
          },
        });
      });
      return this.findAdminDetail(id);
    }

    if (!Number.isSafeInteger(refundAmount) || refundAmount <= 0) {
      throw new BadRequestException('退款金额必须大于0分');
    }
    if (aftersale.type === 2) {
      const refundCap = calculateOrderItemRefundCap(
        aftersale.order,
        aftersale.orderItem,
        aftersale.id,
      );
      if (refundAmount !== refundCap.remainingAmount) {
        throw new BadRequestException(
          `当前售后模型不支持部分数量退货；退货退款必须一次退清该订单项剩余可退金额${refundCap.remainingAmount}分，避免退款金额与库存归还数量不一致`,
        );
      }
    }

    return super.approve(id, adminId, refundAmount);
  }

  override async refund(id: string, adminId: string) {
    const aftersaleId = parsePositiveBigIntId(id, '售后单');
    const adminIdValue = parsePositiveBigIntId(adminId, '管理员');
    const aftersale = await this.productionPrisma.aftersaleOrder.findFirst({
      where: { id: aftersaleId },
      include: { order: true },
    });
    if (!aftersale) throw new NotFoundException('售后单不存在');
    if ((aftersale.order.payAmount ?? 0) !== 0) {
      return super.refund(id, adminId);
    }
    if (aftersale.refundAmount !== 0) {
      throw new BadRequestException('0元订单退款金额状态异常');
    }
    if (aftersale.type === 2 && aftersale.status === AftersaleStatus.approved) {
      throw new BadRequestException('退货退款需等待用户退货并确认收货后再退款');
    }
    if (![AftersaleStatus.approved, AftersaleStatus.returned].includes(aftersale.status)) {
      throw new BadRequestException('售后单状态不允许退款');
    }

    const previousStatus = aftersale.status;
    await this.productionPrisma.$transaction(async (tx) => {
      const claimed = await tx.aftersaleOrder.updateMany({
        where: { id: aftersaleId, status: previousStatus },
        data: { status: AftersaleStatus.pending_refund },
      });
      if (claimed.count !== 1) throw new BadRequestException('售后单状态已变化，请刷新后重试');
      await tx.aftersaleLog.create({
        data: {
          aftersaleId,
          operatorType: 'admin',
          operatorId: adminIdValue,
          action: 'refund',
          content: '管理员发起0元订单售后结算',
        },
      });
    });

    try {
      await this.productionPaymentService.createRefund({
        orderId: aftersale.orderId.toString(),
        refundAmount: 0,
        reason: `售后退款: ${aftersale.reason}`,
        aftersaleId: aftersale.id.toString(),
      });
    } catch (error) {
      await this.productionPrisma.aftersaleOrder.updateMany({
        where: { id: aftersaleId, status: AftersaleStatus.pending_refund },
        data: { status: previousStatus },
      });
      throw error;
    }

    return this.findAdminDetail(id);
  }
}
