import { Module } from '@nestjs/common';
import { WeappShareController } from './share.controller';
import { ShareService } from './share.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { RedisModule } from '../common/redis/redis.module';
import { PointsModule } from '../points/points.module';

@Module({
  imports: [PrismaModule, RedisModule, PointsModule],
  controllers: [WeappShareController],
  providers: [ShareService],
  exports: [ShareService],
})
export class ShareModule {}
