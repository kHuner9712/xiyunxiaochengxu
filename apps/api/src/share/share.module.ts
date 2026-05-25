import { Module } from '@nestjs/common';
import { WeappShareController, AdminShareController } from './share.controller';
import { ShareService } from './share.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { RedisModule } from '../common/redis/redis.module';
import { PointsModule } from '../points/points.module';
import { CouponModule } from '../coupon/coupon.module';

@Module({
  imports: [PrismaModule, RedisModule, PointsModule, CouponModule],
  controllers: [WeappShareController, AdminShareController],
  providers: [ShareService],
  exports: [ShareService],
})
export class ShareModule {}
