import { Module, forwardRef } from '@nestjs/common';
import {
  AdminFlashSaleController,
  WeappFlashSaleController,
} from './flash-sale.controller';
import { FlashSaleService } from './flash-sale.service';
import { ProductionFlashSaleService } from './production-flash-sale.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { OrderModule } from '../order/order.module';
import { BenefitPackageModule } from '../benefit-package/benefit-package.module';

@Module({
  imports: [PrismaModule, BenefitPackageModule, forwardRef(() => OrderModule)],
  controllers: [AdminFlashSaleController, WeappFlashSaleController],
  providers: [
    {
      provide: FlashSaleService,
      useClass: ProductionFlashSaleService,
    },
  ],
  exports: [FlashSaleService],
})
export class FlashSaleModule {}
