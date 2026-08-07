import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RedisService } from '../common/redis/redis.service';
import { OrderService } from '../order/order.service';
import { PaymentService } from '../payment/payment.service';
import { PaymentReconcileService } from '../payment/payment-reconcile.service';
import { FlashSaleService } from '../flash-sale/flash-sale.service';
import { GroupBuyService } from '../group-buy/group-buy.service';
import { MerchantSettlementService } from '../merchant-settlement/merchant-settlement.service';
import { ShareService } from '../share/share.service';

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly orderService: OrderService,
    private readonly paymentService: PaymentService,
    private readonly paymentReconcileService: PaymentReconcileService,
    private readonly flashSaleService: FlashSaleService,
    private readonly groupBuyService: GroupBuyService,
    private readonly merchantSettlementService: MerchantSettlementService,
    private readonly shareService: ShareService,
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
    if (!lockValue) return;
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

  @Cron('30 * * * * *')
  async handleReleaseExpiredFlashSaleLocks() {
    const lockKey = 'schedule:release_expired_flash_sale_locks';
    const lockValue = await this.acquireLock(lockKey, 120);
    if (!lockValue) return;
    try {
      const result = await this.flashSaleService.releaseExpiredLocks();
      if (result.released > 0) {
        this.logger.log(`秒杀过期库存锁自动释放完成，共释放 ${result.released} 条`);
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`秒杀过期库存锁自动释放失败：${err.message}`, err.stack);
    } finally {
      await this.releaseLock(lockKey, lockValue);
    }
  }

  @Cron('15 * * * * *')
  async handleExpiredGroupBuys() {
    const lockKey = 'schedule:expire_group_buys';
    const lockValue = await this.acquireLock(lockKey, 240);
    if (!lockValue) return;
    try {
      const result = (await this.groupBuyService.markExpiredGroups()) as {
        affected: number;
        refundOrderIds?: string[];
      };
      let refundSubmitted = 0;
      let refundFailed = 0;
      for (const orderId of result.refundOrderIds ?? []) {
        try {
          const refundResult = await (this.paymentService as any).createGroupBuyFailureRefund(
            orderId,
            '拼团失败自动退款',
          );
          if (refundResult?.status !== 'not_group_buy' && refundResult?.status !== 'group_not_failed') {
            refundSubmitted += 1;
          }
        } catch (error) {
          refundFailed += 1;
          this.logger.error(
            `拼团失败自动退款提交失败：orderId=${orderId}, error=${(error as Error).message}`,
          );
        }
      }
      if (result.affected > 0 || refundSubmitted > 0 || refundFailed > 0) {
        this.logger.log(
          `拼团过期任务完成: failedGroups=${result.affected}, refundSubmitted=${refundSubmitted}, refundFailed=${refundFailed}`,
        );
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`拼团过期与退款任务失败：${err.message}`, err.stack);
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

  @Cron('0 15 * * * *')
  async handleMatureSalesCommissions() {
    const lockKey = 'schedule:mature_sales_commissions';
    const lockValue = await this.acquireLock(lockKey, 1800);
    if (!lockValue) return;
    try {
      const result = await (this.merchantSettlementService as any).generateMatureSalesCommissions?.();
      if (result && (result.generated > 0 || result.failed > 0)) {
        this.logger.log(`成熟订单销售分佣任务完成: ${JSON.stringify(result)}`);
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`成熟订单销售分佣任务失败：${err.message}`, err.stack);
    } finally {
      await this.releaseLock(lockKey, lockValue);
    }
  }

  @Cron('0 20 * * * *')
  async handleMatureReferralRewards() {
    const lockKey = 'schedule:mature_referral_rewards';
    const lockValue = await this.acquireLock(lockKey, 1800);
    if (!lockValue) return;
    try {
      const result = await (this.shareService as any).reconcileMatureFirstPaidRewards?.();
      if (result && (result.issued > 0 || result.failed > 0)) {
        this.logger.log(`成熟首单邀请奖励任务完成: ${JSON.stringify(result)}`);
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`成熟首单邀请奖励任务失败：${err.message}`, err.stack);
    } finally {
      await this.releaseLock(lockKey, lockValue);
    }
  }

  @Cron('0 0 2 * * *')
  async handleAutoCompleteOrders() {
    const lockKey = 'schedule:auto_complete_orders';
    const lockValue = await this.acquireLock(lockKey, 3600);
    if (!lockValue) return;
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