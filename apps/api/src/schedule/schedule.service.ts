import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Cron, SchedulerRegistry } from '@nestjs/schedule';
import { AFTERSALE_APPLY_DAYS } from '@baby-mall/shared';
import { PAYMENT_STATUS } from '../common/constants';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { OrderService } from '../order/order.service';
import { CancellationSafeProductionOrderService } from '../order/cancellation-safe-production-order.service';
import { PaymentService } from '../payment/payment.service';
import { CancellationSafeStockSafePaymentService } from '../payment/cancellation-safe-stock-safe-payment.service';
import { PaymentReconcileService } from '../payment/payment-reconcile.service';
import { HistoricalAnomalyPaymentReconcileService } from '../payment/historical-anomaly-payment-reconcile.service';
import { FlashSaleService } from '../flash-sale/flash-sale.service';
import { ProductionFlashSaleService } from '../flash-sale/production-flash-sale.service';
import { GroupBuyService } from '../group-buy/group-buy.service';
import { ProductionGroupBuyService } from '../group-buy/production-group-buy.service';
import { MerchantSettlementService } from '../merchant-settlement/merchant-settlement.service';
import { ProductionMerchantSettlementService } from '../merchant-settlement/production-merchant-settlement.service';
import { ShareService } from '../share/share.service';
import { ProductionShareService } from '../share/production-share.service';
import { BenefitPackageService } from '../benefit-package/benefit-package.service';
import { SnapshotGuardedProductionBenefitPackageService } from '../benefit-package/snapshot-guarded-production-benefit-package.service';

@Injectable()
export class ScheduleService implements OnModuleDestroy {
  private readonly logger = new Logger(ScheduleService.name);
  private shuttingDown = false;
  private activeExecutions = 0;
  private readonly drainWaiters = new Set<() => void>();

  constructor(
    private readonly redisService: RedisService,
    private readonly prismaService: PrismaService,
    @Inject(OrderService)
    private readonly orderService: CancellationSafeProductionOrderService,
    @Inject(PaymentService)
    private readonly paymentService: CancellationSafeStockSafePaymentService,
    @Inject(PaymentReconcileService)
    private readonly paymentReconcileService: HistoricalAnomalyPaymentReconcileService,
    @Inject(FlashSaleService)
    private readonly flashSaleService: ProductionFlashSaleService,
    @Inject(GroupBuyService)
    private readonly groupBuyService: ProductionGroupBuyService,
    @Inject(MerchantSettlementService)
    private readonly merchantSettlementService: ProductionMerchantSettlementService,
    @Inject(ShareService)
    private readonly shareService: ProductionShareService,
    @Inject(BenefitPackageService)
    private readonly benefitPackageService: SnapshotGuardedProductionBenefitPackageService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  async onModuleDestroy(): Promise<void> {
    if (this.shuttingDown) return;
    this.shuttingDown = true;

    let stopped = 0;
    for (const [name, cronJob] of this.schedulerRegistry.getCronJobs()) {
      try {
        cronJob.stop();
        stopped += 1;
      } catch (error) {
        this.logger.warn(`停止定时任务失败：name=${name}, error=${(error as Error).message}`);
      }
    }

    this.logger.log(
      `API 正在关闭：已停止 ${stopped} 个 Cron，等待 ${this.activeExecutions} 个已进入的调度任务排空`,
    );
    await this.waitForActiveExecutions();
    this.logger.log('调度任务已全部排空，可以关闭 Redis/Prisma');
  }

  private beginExecution(): boolean {
    if (this.shuttingDown) return false;
    this.activeExecutions += 1;
    return true;
  }

  private finishExecution(): void {
    if (this.activeExecutions > 0) {
      this.activeExecutions -= 1;
    }
    if (this.activeExecutions === 0 && this.drainWaiters.size > 0) {
      for (const resolve of this.drainWaiters) resolve();
      this.drainWaiters.clear();
    }
  }

  private async waitForActiveExecutions(): Promise<void> {
    if (this.activeExecutions === 0) return;
    await new Promise<void>((resolve) => {
      const done = () => {
        this.drainWaiters.delete(done);
        resolve();
      };
      this.drainWaiters.add(done);
      if (this.activeExecutions === 0) done();
    });
  }

  private async acquireLock(key: string, ttlSeconds: number): Promise<string | null> {
    if (!this.beginExecution()) return null;

    const value = `${process.pid}-${Date.now()}-${Math.random().toString(36).substring(2)}`;
    try {
      const acquired = await this.redisService.setNX(key, value, ttlSeconds);
      if (!acquired) {
        this.finishExecution();
        return null;
      }

      // SIGTERM may arrive while SET NX is in flight. Do not let a new business task start after
      // shutdown begins; release the just-acquired lock while Redis is still alive.
      if (this.shuttingDown) {
        try {
          await this.redisService.releaseLockWithLua(key, value);
        } finally {
          this.finishExecution();
        }
        return null;
      }
      return value;
    } catch (error) {
      this.finishExecution();
      throw error;
    }
  }

  private async releaseLock(key: string, value: string): Promise<void> {
    try {
      await this.redisService.releaseLockWithLua(key, value);
    } catch (error) {
      this.logger.warn(`释放定时任务锁失败：key=${key}, error=${(error as Error).message}`);
    } finally {
      this.finishExecution();
    }
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
      const promotionCleanup = await this.reconcileCancelledPromotionReservations();
      this.logger.log(
        `超时订单关闭完成，共关闭 ${result.closedCount} 笔；促销残留修复=${JSON.stringify(promotionCleanup)}`,
      );
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
      const result = await this.groupBuyService.markExpiredGroups();
      const durableCandidates = await this.findFailedGroupRefundCandidates();
      const refundOrderIds = Array.from(
        new Set([...(result.refundOrderIds ?? []), ...durableCandidates]),
      );

      let refundSubmitted = 0;
      let refundFailed = 0;
      for (const orderId of refundOrderIds) {
        try {
          const refundResult = await this.paymentService.createGroupBuyFailureRefund(
            orderId,
            '拼团失败自动退款',
          );
          if (refundResult.status !== 'not_group_buy' && refundResult.status !== 'group_not_failed') {
            refundSubmitted += 1;
          }
        } catch (error) {
          refundFailed += 1;
          this.logger.error(
            `拼团失败自动退款提交失败：orderId=${orderId}, error=${(error as Error).message}`,
          );
        }
      }
      if (result.affected > 0 || refundOrderIds.length > 0 || refundSubmitted > 0 || refundFailed > 0) {
        this.logger.log(
          `拼团过期任务完成: failedGroups=${result.affected}, refundCandidates=${refundOrderIds.length}, refundSubmitted=${refundSubmitted}, refundFailed=${refundFailed}`,
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
      const sideEffects = await this.paymentService.reconcilePaidOrderSideEffects();
      this.logger.log(
        `支付对账任务完成: payment=${JSON.stringify(result)}, sideEffects=${JSON.stringify(sideEffects)}`,
      );
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
      const benefitResult = await this.benefitPackageService.reconcileTerminalRefundFreezes();
      const sideEffectResult = await this.paymentService.reconcileRefundSuccessSideEffects();
      this.logger.log(
        `退款对账任务完成: refund=${JSON.stringify(result)}, benefit=${JSON.stringify(benefitResult)}, sideEffects=${JSON.stringify(sideEffectResult)}`,
      );
    } catch (error) {
      const err = error as Error;
      this.logger.error(`退款对账任务失败：${err.message}`, err.stack);
    } finally {
      await this.releaseLock(lockKey, lockValue);
    }
  }

  @Cron('45 */5 * * * *')
  async handleBenefitSettlementReconcile() {
    const lockKey = 'schedule:benefit_settlement_reconcile';
    const lockValue = await this.acquireLock(lockKey, 240);
    if (!lockValue) return;
    try {
      const auditGaps = await this.benefitPackageService.reconcileUsedEntitlementAuditGaps();
      const commissions = await this.merchantSettlementService.reconcileMissingServiceCommissions();
      if (
        auditGaps.total > 0 ||
        commissions.total > 0 ||
        auditGaps.failed > 0 ||
        commissions.failed > 0
      ) {
        this.logger.log(
          `权益核销/服务结算补偿完成: audit=${JSON.stringify(auditGaps)}, commission=${JSON.stringify(commissions)}`,
        );
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`权益核销/服务结算补偿失败：${err.message}`, err.stack);
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
      const result = await this.reconcileMatureSalesCommissionGaps();
      if (result.generated > 0 || result.failed > 0) {
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
      const result = await this.shareService.reconcileMatureFirstPaidRewards();
      if (result.issued > 0 || result.failed > 0) {
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

  private async reconcileMatureSalesCommissionGaps(limit = 200) {
    const cutoff = new Date(
      Date.now() - AFTERSALE_APPLY_DAYS * 24 * 60 * 60 * 1000,
    );
    const rows = await this.prismaService.$queryRaw<Array<{
      id: bigint;
      userId: bigint;
      payAmount: number;
      sourceType: string;
      sourceCode: string;
    }>>`
      SELECT
        o.id AS id,
        o.user_id AS userId,
        o.pay_amount AS payAmount,
        o.source_type AS sourceType,
        o.source_code AS sourceCode
      FROM orders o
      WHERE o.status = 'completed'
        AND o.completed_at IS NOT NULL
        AND o.completed_at <= ${cutoff}
        AND o.source_type = 'merchant_referral'
        AND o.source_code IS NOT NULL
        AND COALESCE(o.pay_amount, 0) > 0
        AND NOT EXISTS (
          SELECT 1
          FROM merchant_commission_records r
          WHERE r.order_id = o.id
            AND r.source_type = 'sales_referral'
            AND r.deleted_at IS NULL
        )
      ORDER BY o.completed_at ASC, o.id ASC
      LIMIT ${limit}
    `;

    let generated = 0;
    let skipped = 0;
    let failed = 0;
    for (const row of rows) {
      try {
        await this.merchantSettlementService.generateSalesCommission(
          row.id,
          row.userId,
          row.payAmount ?? 0,
          row.sourceType,
          row.sourceCode,
        );
        const record = await this.prismaService.merchantCommissionRecord.findFirst({
          where: {
            orderId: row.id,
            sourceType: 'sales_referral',
            deletedAt: null,
          },
          select: { id: true },
        });
        if (record) generated += 1;
        else skipped += 1;
      } catch (error) {
        failed += 1;
        this.logger.error(
          `成熟订单销售分佣补偿失败：orderId=${row.id}, error=${(error as Error).message}`,
        );
      }
    }
    return { total: rows.length, generated, skipped, failed };
  }

  private async reconcileCancelledPromotionReservations(limit = 200) {
    const flashRows = await this.prismaService.$queryRaw<Array<{ orderId: bigint }>>`
      SELECT f.order_id AS orderId
      FROM flash_sale_orders f
      INNER JOIN orders o ON o.id = f.order_id
      WHERE f.deleted_at IS NULL
        AND f.status = 'pending_payment'
        AND o.status = 'cancelled'
      ORDER BY f.id ASC
      LIMIT ${limit}
    `;
    const groupRows = await this.prismaService.$queryRaw<Array<{ orderId: bigint }>>`
      SELECT m.order_id AS orderId
      FROM group_buy_members m
      INNER JOIN orders o ON o.id = m.order_id
      WHERE m.deleted_at IS NULL
        AND m.status = 'pending_payment'
        AND o.status = 'cancelled'
      ORDER BY m.id ASC
      LIMIT ${limit}
    `;

    let flashFixed = 0;
    let groupFixed = 0;
    let failed = 0;
    for (const row of flashRows) {
      try {
        await this.flashSaleService.handleOrderCancel(row.orderId);
        flashFixed += 1;
      } catch (error) {
        failed += 1;
        this.logger.error(
          `取消订单秒杀占用补偿失败：orderId=${row.orderId}, error=${(error as Error).message}`,
        );
      }
    }
    for (const row of groupRows) {
      try {
        await this.groupBuyService.handleOrderCancel(row.orderId);
        groupFixed += 1;
      } catch (error) {
        failed += 1;
        this.logger.error(
          `取消订单拼团占用补偿失败：orderId=${row.orderId}, error=${(error as Error).message}`,
        );
      }
    }
    return { flashCandidates: flashRows.length, groupCandidates: groupRows.length, flashFixed, groupFixed, failed };
  }

  private async findFailedGroupRefundCandidates(limit = 200): Promise<string[]> {
    const rows = await this.prismaService.$queryRaw<Array<{ orderId: bigint }>>`
      SELECT DISTINCT m.order_id AS orderId
      FROM group_buy_members m
      INNER JOIN group_buy_groups g ON g.id = m.group_id
      INNER JOIN orders o ON o.id = m.order_id
      LEFT JOIN order_payments p ON p.order_id = o.id
      WHERE g.deleted_at IS NULL
        AND g.status IN ('failed', 'cancelled')
        AND m.deleted_at IS NULL
        AND m.status = 'paid'
        AND (COALESCE(o.pay_amount, 0) = 0 OR p.status = ${PAYMENT_STATUS.SUCCESS})
      ORDER BY m.order_id ASC
      LIMIT ${limit}
    `;
    return rows.map((row) => row.orderId.toString());
  }
}
