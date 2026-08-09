import { Module } from '@nestjs/common';
import { AdminMerchantSettlementController } from './merchant-settlement.controller';
import { MerchantSettlementService } from './merchant-settlement.service';
import { RefundSafeProductionMerchantSettlementService } from './refund-safe-production-merchant-settlement.service';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AdminMerchantSettlementController],
  providers: [
    {
      provide: MerchantSettlementService,
      useClass: RefundSafeProductionMerchantSettlementService,
    },
  ],
  exports: [MerchantSettlementService],
})
export class MerchantSettlementModule {}
