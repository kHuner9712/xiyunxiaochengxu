import { Module } from '@nestjs/common';
import { AdminMerchantSettlementController } from './merchant-settlement.controller';
import { MerchantSettlementService } from './merchant-settlement.service';
import { TemporalRuleMerchantSettlementService } from './temporal-rule-merchant-settlement.service';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AdminMerchantSettlementController],
  providers: [
    {
      provide: MerchantSettlementService,
      useClass: TemporalRuleMerchantSettlementService,
    },
  ],
  exports: [MerchantSettlementService],
})
export class MerchantSettlementModule {}
