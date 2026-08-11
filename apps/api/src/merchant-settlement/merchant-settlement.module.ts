import { Module } from '@nestjs/common';
import { AdminMerchantSettlementController } from './merchant-settlement.controller';
import { MerchantSettlementService } from './merchant-settlement.service';
import { SnapshotAwareStateSafeMerchantSettlementService } from './snapshot-aware-state-safe-merchant-settlement.service';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AdminMerchantSettlementController],
  providers: [
    {
      provide: MerchantSettlementService,
      useClass: SnapshotAwareStateSafeMerchantSettlementService,
    },
  ],
  exports: [MerchantSettlementService],
})
export class MerchantSettlementModule {}
