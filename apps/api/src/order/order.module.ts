import { Module, forwardRef } from '@nestjs/common';
import { WeappOrderController, AdminOrderController } from './order.controller';
import { OrderService } from './order.service';
import { MemberBenefitProductionOrderService } from './member-benefit-production-order.service';
import { PromotionCheckoutService } from './promotion-checkout.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { BusinessEventModule } from '../common/business-event.module';
import { BenefitPackageModule } from '../benefit-package/benefit-package.module';
import { GroupBuyModule } from '../group-buy/group-buy.module';
import { FlashSaleModule } from '../flash-sale/flash-sale.module';
import { SystemConfigModule } from '../system-config/system-config.module';

@Module({
  imports: [
    PrismaModule,
    BusinessEventModule,
    BenefitPackageModule,
    SystemConfigModule,
    forwardRef(() => GroupBuyModule),
    forwardRef(() => FlashSaleModule),
  ],
  controllers: [WeappOrderController, AdminOrderController],
  providers: [
    PromotionCheckoutService,
    {
      provide: OrderService,
      useClass: MemberBenefitProductionOrderService,
    },
  ],
  exports: [OrderService, PromotionCheckoutService],
})
export class OrderModule {}
