import { Module } from '@nestjs/common';
import { AdminGroupBuyController, WeappGroupBuyController } from './group-buy.controller';
import { GroupBuyService } from './group-buy.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { OrderModule } from '../order/order.module';

@Module({
  imports: [PrismaModule, OrderModule],
  controllers: [AdminGroupBuyController, WeappGroupBuyController],
  providers: [GroupBuyService],
  exports: [GroupBuyService],
})
export class GroupBuyModule {}
