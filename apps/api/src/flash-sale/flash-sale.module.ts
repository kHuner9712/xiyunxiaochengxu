import { Module, forwardRef } from '@nestjs/common';
import { AdminFlashSaleController, WeappFlashSaleController } from './flash-sale.controller';
import { FlashSaleService } from './flash-sale.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { OrderModule } from '../order/order.module';

@Module({
  imports: [PrismaModule, forwardRef(() => OrderModule)],
  controllers: [AdminFlashSaleController, WeappFlashSaleController],
  providers: [FlashSaleService],
  exports: [FlashSaleService],
})
export class FlashSaleModule {}
