import { Module, forwardRef } from '@nestjs/common';
import { PaymentController, RefundController, PaymentReconcileController, RefundReconcileController, PaymentCompensationController } from './payment.controller';
import { PaymentService } from './payment.service';
import { PaymentReconcileService } from './payment-reconcile.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { OrderModule } from '../order/order.module';
import { ShareModule } from '../share/share.module';
import { BenefitPackageModule } from '../benefit-package/benefit-package.module';

@Module({
  imports: [PrismaModule, forwardRef(() => OrderModule), ShareModule, BenefitPackageModule],
  controllers: [PaymentController, RefundController, PaymentReconcileController, RefundReconcileController, PaymentCompensationController],
  providers: [PaymentService, PaymentReconcileService],
  exports: [PaymentService, PaymentReconcileService],
})
export class PaymentModule {}
