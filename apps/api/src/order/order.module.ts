import { Module } from '@nestjs/common';
import { WeappOrderController, AdminOrderController } from './order.controller';
import { OrderService } from './order.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { BenefitPackageModule } from '../benefit-package/benefit-package.module';

@Module({
  imports: [PrismaModule, BenefitPackageModule],
  controllers: [WeappOrderController, AdminOrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
