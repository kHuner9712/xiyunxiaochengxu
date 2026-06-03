import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { AdminStockController } from './stock.controller';
import { StockService } from './stock.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdminStockController],
  providers: [StockService],
})
export class StockModule {}
