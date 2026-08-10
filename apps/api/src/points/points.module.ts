import { Module } from '@nestjs/common';
import { WeappPointsController, AdminPointsController } from './points.controller';
import { PointsService } from './points.service';
import { RuntimeConfiguredPointsService } from './runtime-configured-points.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { RedisModule } from '../common/redis/redis.module';
import { SystemConfigModule } from '../system-config/system-config.module';

@Module({
  imports: [PrismaModule, RedisModule, SystemConfigModule],
  controllers: [WeappPointsController, AdminPointsController],
  providers: [
    { provide: PointsService, useClass: RuntimeConfiguredPointsService },
  ],
  exports: [PointsService],
})
export class PointsModule {}
