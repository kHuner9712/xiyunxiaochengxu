import { Module } from '@nestjs/common';
import { WeappOrderController, AdminOrderController } from './order.controller';
import { OrderService } from './order.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerRegistry } from '@nestjs/schedule';

@Module({
  imports: [PrismaModule],
  controllers: [WeappOrderController, AdminOrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
