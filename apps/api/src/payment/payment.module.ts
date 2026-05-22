import { Module } from '@nestjs/common';
import { PaymentController, RefundController } from './payment.controller';
import { PaymentService } from './payment.service';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PaymentController, RefundController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
