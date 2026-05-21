import { Module } from '@nestjs/common';
import { WeappBrandController, AdminBrandController } from './brand.controller';
import { BrandService } from './brand.service';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WeappBrandController, AdminBrandController],
  providers: [BrandService],
  exports: [BrandService],
})
export class BrandModule {}
