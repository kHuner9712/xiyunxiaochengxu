import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { AdminMerchantPromotionSourceController } from './merchant-promotion-source.controller';
import { IdentitySafeMerchantPromotionSourceService } from './identity-safe-merchant-promotion-source.service';
import { MerchantPromotionSourceService } from './merchant-promotion-source.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdminMerchantPromotionSourceController],
  providers: [
    {
      provide: MerchantPromotionSourceService,
      useClass: IdentitySafeMerchantPromotionSourceService,
    },
  ],
  exports: [MerchantPromotionSourceService],
})
export class MerchantPromotionSourceModule {}
