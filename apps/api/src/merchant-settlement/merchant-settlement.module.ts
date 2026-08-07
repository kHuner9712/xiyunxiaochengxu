import { Module } from '@nestjs/common';
import { AdminMerchantSettlementController } from './merchant-settlement.controller';
import { MerchantSettlementService } from './merchant-settlement.service';
import { ProductionMerchantSettlementService } from './production-merchant-settlement.service';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AdminMerchantSettlementController],
  providers: [
    {
      provide: MerchantSettlementService,
      useClass: ProductionMerchantSettlementService,
    },
  ],
  exports: [MerchantSettlementService],
})
export class MerchantSettlementModule {}