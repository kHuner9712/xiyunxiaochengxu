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
import { PointsModule } from '../points/points.module';
import { PointsExpiryScheduleService } from '../points/points-expiry-schedule.service';
import { UploadModule } from '../upload/upload.module';
import { DirectProfileCleanupScheduleService } from '../upload/direct-profile-cleanup-schedule.service';
import { MemberModule } from '../member/member.module';
import { MemberLevelReconcileScheduleService } from '../member/member-level-reconcile-schedule.service';

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
    PointsModule,
    UploadModule,
    MemberModule,
    forwardRef(() => PaymentModule),
  ],
  providers: [
    ScheduleService,
    PointsExpiryScheduleService,
    DirectProfileCleanupScheduleService,
    MemberLevelReconcileScheduleService,
  ],
})
export class ScheduleModule {}
