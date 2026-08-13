import { Module, forwardRef } from '@nestjs/common';
import { WeappOrderController, AdminOrderController } from './order.controller';
import { OrderService } from './order.service';
import { PickupSafeIdempotentAttributionSafeMemberBenefitOrderService } from './pickup-safe-order.service';
import { PromotionCheckoutService } from './promotion-checkout.service';
import { PickupSafeAttributionAwarePromotionCheckoutService } from './pickup-safe-promotion-checkout.service';
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
    {
      provide: PromotionCheckoutService,
      useClass: PickupSafeAttributionAwarePromotionCheckoutService,
    },
    {
      provide: OrderService,
      useClass: PickupSafeIdempotentAttributionSafeMemberBenefitOrderService,
    },
  ],
  exports: [OrderService, PromotionCheckoutService],
})
export class OrderModule {}
