import { Module, forwardRef } from '@nestjs/common';
import {
  WeappBenefitPackageController,
  AdminBenefitPackageController,
} from './benefit-package.controller';
import { BenefitPackageService } from './benefit-package.service';
import { ProductionBenefitPackageService } from './production-benefit-package.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { MerchantSettlementModule } from '../merchant-settlement/merchant-settlement.module';

@Module({
  imports: [PrismaModule, forwardRef(() => MerchantSettlementModule)],
  controllers: [WeappBenefitPackageController, AdminBenefitPackageController],
  providers: [
    {
      provide: BenefitPackageService,
      useClass: ProductionBenefitPackageService,
    },
  ],
  exports: [BenefitPackageService],
})
export class BenefitPackageModule {}