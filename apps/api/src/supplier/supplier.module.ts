import { Module } from '@nestjs/common';
import { AdminSupplierController } from './supplier.controller';
import { SupplierService } from './supplier.service';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AdminSupplierController],
  providers: [SupplierService],
  exports: [SupplierService],
})
export class SupplierModule {}
