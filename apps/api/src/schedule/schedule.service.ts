import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RedisService } from '../common/redis/redis.service';
import { OrderService } from '../order/order.service';

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly orderService: OrderService,
  ) {}

  private async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
    const value = `${process.pid}-${Date.now()}`;
    return this.redisService.setNX(key, value, ttlSeconds);
  }

  private async releaseLock(key: string): Promise<void> {
    await this.redisService.del(key);
  }

  @Cron('*/1 * * * *')
  async handleCloseTimeoutOrders() {
    const lockKey = 'schedule:close_timeout_orders';
    const lockAcquired = await this.acquireLock(lockKey, 120);

    if (!lockAcquired) {
      return;
    }

    try {
      this.logger.log('开始扫描超时未支付订单...');
      const result = await this.orderService.closeTimeoutOrders();
      this.logger.log(`超时订单关闭完成，共关闭 ${result.closedCount} 笔`);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`关闭超时订单任务失败：${err.message}`, err.stack);
    } finally {
      await this.releaseLock(lockKey);
    }
  }

  @Cron('0 0 2 * * *')
  async handleAutoCompleteOrders() {
    const lockKey = 'schedule:auto_complete_orders';
    const lockAcquired = await this.acquireLock(lockKey, 3600);

    if (!lockAcquired) {
      return;
    }

    try {
      this.logger.log('开始扫描超时未确认收货订单...');
      const result = await this.orderService.autoCompleteOrders();
      this.logger.log(`自动完成订单任务完成，共完成 ${result.completedCount} 笔`);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`自动完成订单任务失败：${err.message}`, err.stack);
    } finally {
      await this.releaseLock(lockKey);
    }
  }
}
