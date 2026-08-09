import { Module } from '@nestjs/common';
import { WeappActivityController, AdminActivityController } from './activity.controller';
import { ActivityService } from './activity.service';
import { CheckoutReadyProductionActivityService } from './checkout-ready-production-activity.service';
import { ActivityCheckoutService } from './activity-checkout.service';
import { ActivityMultiItemCheckoutService } from './activity-multi-item-checkout.service';
import { ExclusiveNewUserActivityCheckoutService } from './exclusive-new-user-activity-checkout.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { ContentModule } from '../content/content.module';
import { OrderModule } from '../order/order.module';
import { SystemConfigModule } from '../system-config/system-config.module';

@Module({
  imports: [PrismaModule, ContentModule, OrderModule, SystemConfigModule],
  controllers: [WeappActivityController, AdminActivityController],
  providers: [
    ActivityMultiItemCheckoutService,
    { provide: ActivityCheckoutService, useClass: ExclusiveNewUserActivityCheckoutService },
    { provide: ActivityService, useClass: CheckoutReadyProductionActivityService },
  ],
  exports: [ActivityService, ActivityCheckoutService],
})
export class ActivityModule {}
