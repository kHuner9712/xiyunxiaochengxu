import { Module } from '@nestjs/common';
import { WeappCouponController, AdminCouponController } from './coupon.controller';
import { CouponService } from './coupon.service';
import { IdempotentGrowthAwareCouponService } from './idempotent-growth-aware-coupon.service';
import { DurableAdminCouponService } from './durable-admin-coupon.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { RedisModule } from '../common/redis/redis.module';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [WeappCouponController, AdminCouponController],
  providers: [
    DurableAdminCouponService,
    { provide: IdempotentGrowthAwareCouponService, useExisting: DurableAdminCouponService },
    { provide: CouponService, useExisting: DurableAdminCouponService },
  ],
  exports: [CouponService],
})
export class CouponModule {}
