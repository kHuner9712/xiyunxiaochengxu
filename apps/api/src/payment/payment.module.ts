import { Module, forwardRef } from '@nestjs/common';
import { PaymentController, RefundController, PaymentReconcileController, RefundReconcileController, PaymentCompensationController } from './payment.controller';
import { PaymentService } from './payment.service';
import { ConfirmedMissingRefundRetryPaymentService } from './confirmed-missing-refund-retry-payment.service';
import { PaymentReconcileService } from './payment-reconcile.service';
import { HistoricalAnomalyPaymentReconcileService } from './historical-anomaly-payment-reconcile.service';
import { PaymentReconcileExecutionService } from './payment-reconcile-execution.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { OrderModule } from '../order/order.module';
import { ShareModule } from '../share/share.module';
import { BenefitPackageModule } from '../benefit-package/benefit-package.module';
import { MerchantSettlementModule } from '../merchant-settlement/merchant-settlement.module';
import { GroupBuyModule } from '../group-buy/group-buy.module';
import { FlashSaleModule } from '../flash-sale/flash-sale.module';

@Module({
  imports: [PrismaModule, forwardRef(() => OrderModule), ShareModule, BenefitPackageModule, MerchantSettlementModule, GroupBuyModule, FlashSaleModule],
  controllers: [PaymentController, RefundController, PaymentReconcileController, RefundReconcileController, PaymentCompensationController],
  providers: [
    {
      provide: PaymentService,
      useClass: ConfirmedMissingRefundRetryPaymentService,
    },
    {
      provide: PaymentReconcileService,
      useClass: HistoricalAnomalyPaymentReconcileService,
    },
    PaymentReconcileExecutionService,
  ],
  exports: [PaymentService, PaymentReconcileService],
})
export class PaymentModule {}
