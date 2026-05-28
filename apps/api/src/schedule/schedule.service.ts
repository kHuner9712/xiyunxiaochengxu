import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RedisService } from '../common/redis/redis.service';
import { OrderService } from '../order/order.service';
import { PaymentReconcileService } from '../payment/payment-reconcile.service';

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly orderService: OrderService,
    private readonly paymentReconcileService: PaymentReconcileService,
  ) {}

  private async acquireLock(key: string, ttlSeconds: number): Promise<string | null> {
    const value = `${process.pid}-${Date.now()}-${Math.random().toString(36).substring(2)}`;
    const acquired = await this.redisService.setNX(key, value, ttlSeconds);
    return acquired ? value : null;
  }

  private async releaseLock(key: string, value: string): Promise<void> {
    await this.redisService.releaseLockWithLua(key, value);
  }

  @Cron('*/1 * * * *')
  async handleCloseTimeoutOrders() {
    const lockKey = 'schedule:close_timeout_orders';
    const lockValue = await this.acquireLock(lockKey, 120);

    if (!lockValue) {
      return;
    }

    try {
      this.logger.log('开始扫描超时未支付订单...');
      const preCheck = await this.paymentReconcileService.confirmTimeoutOrdersBeforeClose();
      this.logger.log(`关单前支付确认完成: ${JSON.stringify(preCheck)}`);
      const result = await this.orderService.closeTimeoutOrders();
      this.logger.log(`超时订单关闭完成，共关闭 ${result.closedCount} 笔`);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`关闭超时订单任务失败：${err.message}`, err.stack);
    } finally {
      await this.releaseLock(lockKey, lockValue);
    }
  }

  @Cron('*/2 * * * *')
  async handlePaymentReconcile() {
    const lockKey = 'schedule:payment_reconcile';
    const lockValue = await this.acquireLock(lockKey, 240);
    if (!lockValue) return;

    try {
      const result = await this.paymentReconcileService.reconcilePendingPayments();
      this.logger.log(`支付对账任务完成: ${JSON.stringify(result)}`);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`支付对账任务失败：${err.message}`, err.stack);
    } finally {
      await this.releaseLock(lockKey, lockValue);
    }
  }

  @Cron('*/5 * * * *')
  async handleRefundReconcile() {
    const lockKey = 'schedule:refund_reconcile';
    const lockValue = await this.acquireLock(lockKey, 240);
    if (!lockValue) return;

    try {
      const result = await this.paymentReconcileService.reconcilePendingRefunds();
      this.logger.log(`退款对账任务完成: ${JSON.stringify(result)}`);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`退款对账任务失败：${err.message}`, err.stack);
    } finally {
      await this.releaseLock(lockKey, lockValue);
    }
  }

  @Cron('0 0 2 * * *')
  async handleAutoCompleteOrders() {
    const lockKey = 'schedule:auto_complete_orders';
    const lockValue = await this.acquireLock(lockKey, 3600);

    if (!lockValue) {
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
      await this.releaseLock(lockKey, lockValue);
    }
  }
}
