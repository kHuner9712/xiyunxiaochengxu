import { Module } from '@nestjs/common';
import { WeappPointsController, AdminPointsController } from './points.controller';
import { PointsService } from './points.service';
import { ProductionPointsService } from './production-points.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { RedisModule } from '../common/redis/redis.module';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [WeappPointsController, AdminPointsController],
  providers: [
    { provide: PointsService, useClass: ProductionPointsService },
  ],
  exports: [PointsService],
})
export class PointsModule {}
