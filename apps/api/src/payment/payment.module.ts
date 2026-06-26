import { Module, forwardRef } from '@nestjs/common';
import { PaymentController, RefundController, PaymentReconcileController, RefundReconcileController, PaymentCompensationController } from './payment.controller';
import { PaymentService } from './payment.service';
import { PaymentReconcileService } from './payment-reconcile.service';
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
  providers: [PaymentService, PaymentReconcileService],
  exports: [PaymentService, PaymentReconcileService],
})
export class PaymentModule {}
