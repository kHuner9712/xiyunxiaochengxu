import { Module, forwardRef } from '@nestjs/common';
import { ScheduleModule as NestScheduleModule } from '@nestjs/schedule';
import { ScheduleService } from './schedule.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { RedisModule } from '../common/redis/redis.module';
import { OrderModule } from '../order/order.module';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [NestScheduleModule.forRoot(), PrismaModule, RedisModule, OrderModule, forwardRef(() => PaymentModule)],
  providers: [ScheduleService],
})
export class ScheduleModule {}
