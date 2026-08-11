import { Module, forwardRef } from '@nestjs/common';
import {
  AdminGroupBuyController,
  WeappGroupBuyController,
} from './group-buy.controller';
import { GroupBuyService } from './group-buy.service';
import { IdempotentBigintSafeProductionGroupBuyService } from './idempotent-bigint-safe-production-group-buy.service';
import { PublicGroupBuyViewService } from './public-group-buy-view.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { OrderModule } from '../order/order.module';
import { BenefitPackageModule } from '../benefit-package/benefit-package.module';

@Module({
  imports: [
    PrismaModule,
    BenefitPackageModule,
    forwardRef(() => OrderModule),
  ],
  controllers: [AdminGroupBuyController, WeappGroupBuyController],
  providers: [
    {
      provide: GroupBuyService,
      useClass: IdempotentBigintSafeProductionGroupBuyService,
    },
    PublicGroupBuyViewService,
  ],
  exports: [GroupBuyService],
})
export class GroupBuyModule {}
