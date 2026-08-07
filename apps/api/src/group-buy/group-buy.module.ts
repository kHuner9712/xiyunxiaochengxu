import { Module, forwardRef } from '@nestjs/common';
import {
  AdminGroupBuyController,
  WeappGroupBuyController,
} from './group-buy.controller';
import { GroupBuyService } from './group-buy.service';
import { ProductionGroupBuyService } from './production-group-buy.service';
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
      useClass: ProductionGroupBuyService,
    },
  ],
  exports: [GroupBuyService],
})
export class GroupBuyModule {}
