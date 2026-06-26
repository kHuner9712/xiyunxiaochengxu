import { Module } from '@nestjs/common';
import {
  WeappBenefitPackageController,
  AdminBenefitPackageController,
} from './benefit-package.controller';
import { BenefitPackageService } from './benefit-package.service';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WeappBenefitPackageController, AdminBenefitPackageController],
  providers: [BenefitPackageService],
  exports: [BenefitPackageService],
})
export class BenefitPackageModule {}
