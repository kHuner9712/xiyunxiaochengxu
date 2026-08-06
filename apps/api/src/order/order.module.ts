import { Module } from '@nestjs/common';
import { WeappOrderController, AdminOrderController } from './order.controller';
import { OrderService } from './order.service';
import { TransactionalOrderService } from './transactional-order.service';
import { PromotionCheckoutService } from './promotion-checkout.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { BusinessEventModule } from '../common/business-event.module';
import { BenefitPackageModule } from '../benefit-package/benefit-package.module';

@Module({
  imports: [PrismaModule, BusinessEventModule, BenefitPackageModule],
  controllers: [WeappOrderController, AdminOrderController],
  providers: [
    PromotionCheckoutService,
    {
      provide: OrderService,
      useClass: TransactionalOrderService,
    },
  ],
  exports: [OrderService, PromotionCheckoutService],
})
export class OrderModule {}
