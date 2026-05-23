import { Module } from '@nestjs/common';
import { WeappAftersaleController, AdminAftersaleController } from './aftersale.controller';
import { AftersaleService } from './aftersale.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [PrismaModule, PaymentModule],
  controllers: [WeappAftersaleController, AdminAftersaleController],
  providers: [AftersaleService],
  exports: [AftersaleService],
})
export class AftersaleModule {}
