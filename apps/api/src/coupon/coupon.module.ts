import { Module } from '@nestjs/common';
import { WeappCouponController, AdminCouponController } from './coupon.controller';
import { CouponService } from './coupon.service';
import { IdempotentGrowthAwareCouponService } from './idempotent-growth-aware-coupon.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { RedisModule } from '../common/redis/redis.module';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [WeappCouponController, AdminCouponController],
  providers: [
    IdempotentGrowthAwareCouponService,
    { provide: CouponService, useExisting: IdempotentGrowthAwareCouponService },
  ],
  exports: [CouponService],
})
export class CouponModule {}
