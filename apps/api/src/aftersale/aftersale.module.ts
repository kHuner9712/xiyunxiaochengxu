import { Module } from '@nestjs/common';
import { WeappAftersaleController, AdminAftersaleController } from './aftersale.controller';
import { AftersaleService } from './aftersale.service';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WeappAftersaleController, AdminAftersaleController],
  providers: [AftersaleService],
  exports: [AftersaleService],
})
export class AftersaleModule {}
