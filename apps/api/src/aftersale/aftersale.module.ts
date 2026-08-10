import { Module } from '@nestjs/common';
import { WeappAftersaleController, AdminAftersaleController } from './aftersale.controller';
import { AftersaleService } from './aftersale.service';
import { ReturnDestinationViewAftersaleService } from './return-destination-view-aftersale.service';
import { AftersaleReviewService } from './aftersale-review.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { PaymentModule } from '../payment/payment.module';
import { SystemConfigModule } from '../system-config/system-config.module';

@Module({
  imports: [PrismaModule, PaymentModule, SystemConfigModule],
  controllers: [WeappAftersaleController, AdminAftersaleController],
  providers: [
    {
      provide: AftersaleService,
      useClass: ReturnDestinationViewAftersaleService,
    },
    AftersaleReviewService,
  ],
  exports: [AftersaleService],
})
export class AftersaleModule {}
