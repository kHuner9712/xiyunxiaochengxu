import { Module, forwardRef } from '@nestjs/common';
import { ScheduleModule as NestScheduleModule } from '@nestjs/schedule';
import { ScheduleService } from './schedule.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { RedisModule } from '../common/redis/redis.module';
import { OrderModule } from '../order/order.module';
import { PaymentModule } from '../payment/payment.module';
import { FlashSaleModule } from '../flash-sale/flash-sale.module';
import { GroupBuyModule } from '../group-buy/group-buy.module';
import { MerchantSettlementModule } from '../merchant-settlement/merchant-settlement.module';
import { ShareModule } from '../share/share.module';
import { BenefitPackageModule } from '../benefit-package/benefit-package.module';

@Module({
  imports: [
    NestScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    OrderModule,
    FlashSaleModule,
    GroupBuyModule,
    MerchantSettlementModule,
    ShareModule,
    BenefitPackageModule,
    forwardRef(() => PaymentModule),
  ],
  providers: [ScheduleService],
})
export class ScheduleModule {}
