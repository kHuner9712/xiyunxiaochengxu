import { Module } from '@nestjs/common';
import { ScheduleModule as NestScheduleModule } from '@nestjs/schedule';
import { ScheduleService } from './schedule.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { RedisModule } from '../common/redis/redis.module';
import { OrderModule } from '../order/order.module';

@Module({
  imports: [NestScheduleModule.forRoot(), PrismaModule, RedisModule, OrderModule],
  providers: [ScheduleService],
})
export class ScheduleModule {}
