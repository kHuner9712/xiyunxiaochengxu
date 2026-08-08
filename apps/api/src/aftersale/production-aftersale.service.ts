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
    paymentService: PaymentService,
    @Optional() private readonly systemConfigService?: SystemConfigService,
  ) {
    super(productionPrisma, paymentService);
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
    const aftersale = await this.productionPrisma.aftersaleOrder.findFirst({
      where: { id: BigInt(id) },
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

    if (aftersale?.type === 2 && Number.isInteger(refundAmount) && refundAmount > 0) {
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
}
