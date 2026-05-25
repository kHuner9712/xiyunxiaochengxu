import { Module, forwardRef } from '@nestjs/common';
import { PaymentController, RefundController, PaymentReconcileController, RefundReconcileController } from './payment.controller';
import { PaymentService } from './payment.service';
import { PaymentReconcileService } from './payment-reconcile.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { OrderModule } from '../order/order.module';
import { ShareModule } from '../share/share.module';

@Module({
  imports: [PrismaModule, forwardRef(() => OrderModule), ShareModule],
  controllers: [PaymentController, RefundController, PaymentReconcileController, RefundReconcileController],
  providers: [PaymentService, PaymentReconcileService],
  exports: [PaymentService, PaymentReconcileService],
})
export class PaymentModule {}
