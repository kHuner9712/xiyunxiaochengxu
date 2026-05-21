import { Module } from '@nestjs/common';
import { WeappProductController, AdminProductController } from './product.controller';
import { ProductService } from './product.service';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WeappProductController, AdminProductController],
  providers: [ProductService],
  exports: [ProductService],
})
export class ProductModule {}
