import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { calculateOrderItemRefundCap } from '../common/utils/refund-amount';
import { PaymentService } from '../payment/payment.service';
import { AftersaleService } from './aftersale.service';

@Injectable()
export class ProductionAftersaleService extends AftersaleService {
  constructor(
    private readonly productionPrisma: PrismaService,
    paymentService: PaymentService,
  ) {
    super(productionPrisma, paymentService);
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
