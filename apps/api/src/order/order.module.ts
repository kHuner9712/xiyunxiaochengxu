import { Module, forwardRef } from '@nestjs/common';
import { WeappOrderController, AdminOrderController } from './order.controller';
import { OrderService } from './order.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { BenefitPackageModule } from '../benefit-package/benefit-package.module';
import { GroupBuyModule } from '../group-buy/group-buy.module';

@Module({
  imports: [PrismaModule, BenefitPackageModule, forwardRef(() => GroupBuyModule)],
  controllers: [WeappOrderController, AdminOrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
