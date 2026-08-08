import { Module } from '@nestjs/common';
import { WeappCouponController, AdminCouponController } from './coupon.controller';
import { CouponService } from './coupon.service';
import { AuthoritativeCouponReportingService } from './authoritative-coupon-reporting.service';
import { PrismaModule } from '../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WeappCouponController, AdminCouponController],
  providers: [
    { provide: CouponService, useClass: AuthoritativeCouponReportingService },
  ],
  exports: [CouponService],
})
export class CouponModule {}
