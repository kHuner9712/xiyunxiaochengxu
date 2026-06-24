import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { AdminMerchantPromotionSourceController } from './merchant-promotion-source.controller';
import { MerchantPromotionSourceService } from './merchant-promotion-source.service';

@Module({
  imports: [PrismaModule],
  controllers: [AdminMerchantPromotionSourceController],
  providers: [MerchantPromotionSourceService],
  exports: [MerchantPromotionSourceService],
})
export class MerchantPromotionSourceModule {}
