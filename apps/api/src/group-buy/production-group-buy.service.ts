import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { BenefitPackageService } from '../benefit-package/benefit-package.service';
import { OrderService } from '../order/order.service';
import { PromotionCheckoutService } from '../order/promotion-checkout.service';
import { JoinGroupBuyDto, StartGroupBuyDto } from './dto/group-buy.dto';
import { TransactionalGroupBuyService } from './transactional-group-buy.service';

@Injectable()
export class ProductionGroupBuyService extends TransactionalGroupBuyService {
  constructor(
    private readonly productionPrisma: PrismaService,
    @Inject(forwardRef(() => OrderService))
    orderService: OrderService,
    promotionCheckout: PromotionCheckoutService,
    benefitPackageService: BenefitPackageService,
  ) {
    super(productionPrisma, orderService, promotionCheckout, benefitPackageService);
  }

  override async startGroupBuy(userId: string, dto: StartGroupBuyDto) {
    const result: any = await super.startGroupBuy(userId, dto);
    return this.attachCheckoutState(result);
  }

  override async joinGroupBuy(userId: string, dto: JoinGroupBuyDto) {
    const result: any = await super.joinGroupBuy(userId, dto);
    return this.attachCheckoutState(result);
  }

  private async attachCheckoutState(result: any) {
    const order = await this.productionPrisma.order.findUnique({
      where: { id: BigInt(result.orderId) },
      select: { payAmount: true, status: true },
    });
    return {
      ...result,
      isZeroPay: (order?.payAmount ?? 0) === 0,
      orderStatus: order?.status ?? null,
    };
  }
}
