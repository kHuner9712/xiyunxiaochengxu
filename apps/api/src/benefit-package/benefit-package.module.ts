import { Module, forwardRef } from '@nestjs/common';
import {
  WeappBenefitPackageController,
  AdminBenefitPackageController,
} from './benefit-package.controller';
import { BenefitPackageService } from './benefit-package.service';
import { ZeroPayAwareBenefitPackageService } from './zero-pay-aware-benefit-package.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { MerchantSettlementModule } from '../merchant-settlement/merchant-settlement.module';

@Module({
  imports: [PrismaModule, forwardRef(() => MerchantSettlementModule)],
  controllers: [WeappBenefitPackageController, AdminBenefitPackageController],
  providers: [
    {
      provide: BenefitPackageService,
      useClass: ZeroPayAwareBenefitPackageService,
    },
  ],
  exports: [BenefitPackageService],
})
export class BenefitPackageModule {}