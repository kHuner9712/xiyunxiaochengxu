import { Module, forwardRef } from '@nestjs/common';
import {
  WeappBenefitPackageController,
  AdminBenefitPackageController,
} from './benefit-package.controller';
import { BenefitPackageService } from './benefit-package.service';
import { DurableAdminBenefitPackageService } from './durable-admin-benefit-package.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { MerchantSettlementModule } from '../merchant-settlement/merchant-settlement.module';

@Module({
  imports: [PrismaModule, forwardRef(() => MerchantSettlementModule)],
  controllers: [WeappBenefitPackageController, AdminBenefitPackageController],
  providers: [
    DurableAdminBenefitPackageService,
    {
      provide: BenefitPackageService,
      useExisting: DurableAdminBenefitPackageService,
    },
  ],
  exports: [BenefitPackageService],
})
export class BenefitPackageModule {}
