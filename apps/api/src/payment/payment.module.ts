import { Module } from '@nestjs/common';
import { PaymentController, RefundController, PaymentReconcileController, RefundReconcileController } from './payment.controller';
import { PaymentService } from './payment.service';
import { PaymentReconcileService } from './payment-reconcile.service';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PaymentController, RefundController, PaymentReconcileController, RefundReconcileController],
  providers: [PaymentService, PaymentReconcileService],
  exports: [PaymentService, PaymentReconcileService],
})
export class PaymentModule {}
