import { Module } from '@nestjs/common';
import { WeappActivityController, AdminActivityController } from './activity.controller';
import { ActivityService } from './activity.service';
import { CheckoutReadyProductionActivityService } from './checkout-ready-production-activity.service';
import { ActivityCheckoutService } from './activity-checkout.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { ContentModule } from '../content/content.module';
import { OrderModule } from '../order/order.module';
import { SystemConfigModule } from '../system-config/system-config.module';

@Module({
  imports: [PrismaModule, ContentModule, OrderModule, SystemConfigModule],
  controllers: [WeappActivityController, AdminActivityController],
  providers: [
    ActivityCheckoutService,
    { provide: ActivityService, useClass: CheckoutReadyProductionActivityService },
  ],
  exports: [ActivityService, ActivityCheckoutService],
})
export class ActivityModule {}
