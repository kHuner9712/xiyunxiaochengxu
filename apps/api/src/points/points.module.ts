import { Module } from '@nestjs/common';
import { WeappPointsController, AdminPointsController } from './points.controller';
import { PointsService } from './points.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { RedisModule } from '../common/redis/redis.module';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [WeappPointsController, AdminPointsController],
  providers: [PointsService],
  exports: [PointsService],
})
export class PointsModule {}
