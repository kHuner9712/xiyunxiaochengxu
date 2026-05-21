import { Module } from '@nestjs/common';
import { WeappCartController } from './cart.controller';
import { CartService } from './cart.service';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WeappCartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
