import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BenefitPackageService } from '../benefit-package/benefit-package.service';
import { BusinessEventService } from '../common/business-event.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { calculateOrderItemRefundCap } from '../common/utils/refund-amount';
import { FlashSaleService } from '../flash-sale/flash-sale.service';
import { GroupBuyService } from '../group-buy/group-buy.service';
import { MerchantSettlementService } from '../merchant-settlement/merchant-settlement.service';
import { OrderService } from '../order/order.service';
import { ShareService } from '../share/share.service';
import { RecoverableProductionPaymentService } from './recoverable-production-payment.service';

@Injectable()
export class StockSafeRecoverableProductionPaymentService extends RecoverableProductionPaymentService {
  constructor(
    private readonly stockSafePrisma: PrismaService,
    configService: ConfigService,
    businessEvent: BusinessEventService,
    orderService: OrderService,
    shareService: ShareService,
    benefitPackageService: BenefitPackageService,
    merchantSettlementService: MerchantSettlementService,
    groupBuyService: GroupBuyService,
    flashSaleService: FlashSaleService,
  ) {
    super(
      stockSafePrisma,
      configService,
      businessEvent,
      orderService,
      shareService,
      benefitPackageService,
      merchantSettlementService,
      groupBuyService,
      flashSaleService,
    );
  }

  override async createRefund(params: {
    orderId: string;
    aftersaleId?: string;
    refundAmount: number;
    reason?: string;
  }) {
    if (params.aftersaleId) {
      const aftersale = await this.stockSafePrisma.aftersaleOrder.findFirst({
        where: {
          id: BigInt(params.aftersaleId),
          orderId: BigInt(params.orderId),
        },
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

      if (aftersale?.type === 2) {
        const refundCap = calculateOrderItemRefundCap(
          aftersale.order,
          aftersale.orderItem,
          aftersale.id,
        );
        if (params.refundAmount !== refundCap.remainingAmount) {
          throw new BadRequestException(
            `当前售后模型不支持部分数量退货；退货退款必须一次退清该订单项剩余可退金额${refundCap.remainingAmount}分，避免退款金额与库存归还数量不一致`,
          );
        }
      }
    }

    return super.createRefund(params);
  }
}
