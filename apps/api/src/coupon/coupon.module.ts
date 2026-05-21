import { Module } from '@nestjs/common';
import { WeappCouponController, AdminCouponController } from './coupon.controller';
import { CouponService } from './coupon.service';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WeappCouponController, AdminCouponController],
  providers: [CouponService],
  exports: [CouponService],
})
export class CouponModule {}
