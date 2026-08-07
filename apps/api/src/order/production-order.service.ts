import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { BusinessEventService } from '../common/business-event.service';
import { BenefitPackageService } from '../benefit-package/benefit-package.service';
import { FlashSaleService } from '../flash-sale/flash-sale.service';
import { GroupBuyService } from '../group-buy/group-buy.service';
import { TransactionalOrderService } from './transactional-order.service';

@Injectable()
export class ProductionOrderService extends TransactionalOrderService {
  constructor(
    private readonly productionPrisma: PrismaService,
    businessEvent: BusinessEventService,
    benefitPackageService: BenefitPackageService,
    @Inject(forwardRef(() => GroupBuyService))
    groupBuyService: GroupBuyService,
    @Inject(forwardRef(() => FlashSaleService))
    flashSaleService: FlashSaleService,
  ) {
    super(
      productionPrisma,
      businessEvent,
      benefitPackageService,
      groupBuyService,
      flashSaleService,
    );
  }

  override async getOrderCountByUser(userId: string) {
    const where = { userId: BigInt(userId) };
    const [unpaid, paid, unshipped, pendingPickup, unreceived, aftersale] = await Promise.all([
      this.productionPrisma.order.count({ where: { ...where, status: OrderStatus.pending_payment } }),
      this.productionPrisma.order.count({ where: { ...where, status: OrderStatus.paid } }),
      this.productionPrisma.order.count({ where: { ...where, status: OrderStatus.pending_delivery } }),
      this.productionPrisma.order.count({ where: { ...where, status: OrderStatus.pending_pickup } }),
      this.productionPrisma.order.count({ where: { ...where, status: OrderStatus.delivered } }),
      this.productionPrisma.order.count({ where: { ...where, status: OrderStatus.aftersale } }),
    ]);

    return { unpaid, paid, unshipped, pendingPickup, unreceived, aftersale };
  }
}
