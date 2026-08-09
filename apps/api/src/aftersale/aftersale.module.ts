import { Module } from '@nestjs/common';
import { WeappAftersaleController, AdminAftersaleController } from './aftersale.controller';
import { AftersaleService } from './aftersale.service';
import { AttachmentSafeProductionAftersaleService } from './attachment-safe-production-aftersale.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { PaymentModule } from '../payment/payment.module';
import { SystemConfigModule } from '../system-config/system-config.module';

@Module({
  imports: [PrismaModule, PaymentModule, SystemConfigModule],
  controllers: [WeappAftersaleController, AdminAftersaleController],
  providers: [
    {
      provide: AftersaleService,
      useClass: AttachmentSafeProductionAftersaleService,
    },
  ],
  exports: [AftersaleService],
})
export class AftersaleModule {}
