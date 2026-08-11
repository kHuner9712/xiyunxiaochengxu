import { Module } from '@nestjs/common';
import { WeappShareController, AdminShareController } from './share.controller';
import { ShareService } from './share.service';
import { AtomicShareProductionService } from './atomic-share-production.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { RedisModule } from '../common/redis/redis.module';
import { PointsModule } from '../points/points.module';
import { CouponModule } from '../coupon/coupon.module';
import { SystemConfigModule } from '../system-config/system-config.module';

@Module({
  imports: [PrismaModule, RedisModule, PointsModule, CouponModule, SystemConfigModule],
  controllers: [WeappShareController, AdminShareController],
  providers: [
    {
      provide: ShareService,
      useClass: AtomicShareProductionService,
    },
  ],
  exports: [ShareService],
})
export class ShareModule {}
