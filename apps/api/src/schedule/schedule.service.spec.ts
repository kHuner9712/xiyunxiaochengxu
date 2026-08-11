import { describe, it, expect, jest, beforeEach } from '@jest/globals';
jest.mock('@nestjs/schedule', () => ({
  Cron: () => () => {},
  SchedulerRegistry: class SchedulerRegistry {},
}));
import { ScheduleService } from './schedule.service';

function createRedisService() {
  return {
    setNX: jest.fn(),
    extendLockWithLua: jest.fn(),
    releaseLockWithLua: jest.fn(),
  };
}

function createPrismaService() {
  return {
    $queryRaw: jest.fn(),
    merchantCommissionRecord: {
      findFirst: jest.fn(),
    },
  };
}

function createOrderService() {
  return {
    closeTimeoutOrders: jest.fn(),
    autoCompleteOrders: jest.fn(),
  };
}

function createPaymentService() {
  return {
    createGroupBuyFailureRefund: jest.fn(),
    reconcilePaidOrderSideEffects: jest.fn(),
    reconcileRefundSuccessSideEffects: jest.fn(),
  };
}

function createPaymentReconcileService() {
  return {
    confirmTimeoutOrdersBeforeClose: jest.fn(),
    reconcilePendingPayments: jest.fn(),
    reconcilePendingRefunds: jest.fn(),
  };
}

function createFlashSaleService() {
  return {
    releaseExpiredLocks: jest.fn(),
    handleOrderCancel: jest.fn(),
  };
}

function createGroupBuyService() {
  return {
    markExpiredGroups: jest.fn(),
    handleOrderCancel: jest.fn(),
  };
}

function createMerchantSettlementService() {
  return {
    generateSalesCommission: jest.fn(),
    reconcileMissingServiceCommissions: jest.fn(),
  };
}

function createShareService() {
  return {
    reconcileMatureFirstPaidRewards: jest.fn(),
  };
}

function createBenefitPackageService() {
  return {
    reconcileTerminalRefundFreezes: jest.fn(),
    reconcileUsedEntitlementAuditGaps: jest.fn(),
  };
}

function createSchedulerRegistry() {
  const stop = jest.fn();
  return {
    stop,
    getCronJobs: jest.fn(() => new Map([['schedule-test', { stop }]])),
  };
}

describe('ScheduleService', () => {
  let service: ScheduleService;
  let redisService: ReturnType<typeof createRedisService>;
  let prismaService: ReturnType<typeof createPrismaService>;
  let orderService: ReturnType<typeof createOrderService>;
  let paymentService: ReturnType<typeof createPaymentService>;
  let paymentReconcileService: ReturnType<typeof createPaymentReconcileService>;
  let flashSaleService: ReturnType<typeof createFlashSaleService>;
  let groupBuyService: ReturnType<typeof createGroupBuyService>;
  let merchantSettlementService: ReturnType<typeof createMerchantSettlementService>;
  let shareService: ReturnType<typeof createShareService>;
  let benefitPackageService: ReturnType<typeof createBenefitPackageService>;
  let schedulerRegistry: ReturnType<typeof createSchedulerRegistry>;

  beforeEach(() => {
    redisService = createRedisService();
    prismaService = createPrismaService();
    orderService = createOrderService();
    paymentService = createPaymentService();
    paymentReconcileService = createPaymentReconcileService();
    flashSaleService = createFlashSaleService();
    groupBuyService = createGroupBuyService();
    merchantSettlementService = createMerchantSettlementService();
    shareService = createShareService();
    benefitPackageService = createBenefitPackageService();
    schedulerRegistry = createSchedulerRegistry();
    redisService.setNX.mockImplementation(async () => true);
    redisService.extendLockWithLua.mockImplementation(async () => true);
    redisService.releaseLockWithLua.mockImplementation(async () => true);
    prismaService.$queryRaw.mockImplementation(async () => []);
    prismaService.merchantCommissionRecord.findFirst.mockImplementation(async () => null);
    orderService.closeTimeoutOrders.mockImplementation(async () => ({ closedCount: 0 }));
    orderService.autoCompleteOrders.mockImplementation(async () => ({ completedCount: 0 }));
    paymentService.createGroupBuyFailureRefund.mockImplementation(async () => ({ status: 'pending' }));
    paymentService.reconcilePaidOrderSideEffects.mockImplementation(async () => ({ total: 0 }));
    paymentService.reconcileRefundSuccessSideEffects.mockImplementation(async () => ({ total: 0 }));
    paymentReconcileService.confirmTimeoutOrdersBeforeClose.mockImplementation(async () => ({ total: 0, fixed: 0, delayed: 0, closable: 0, failed: 0 }));
    paymentReconcileService.reconcilePendingPayments.mockImplementation(async () => ({ total: 0, fixed: 0, skipped: 0, failed: 0 }));
    paymentReconcileService.reconcilePendingRefunds.mockImplementation(async () => ({ total: 0, fixed: 0, skipped: 0, failed: 0 }));
    flashSaleService.releaseExpiredLocks.mockImplementation(async () => ({ released: 0 }));
    flashSaleService.handleOrderCancel.mockImplementation(async () => undefined);
    groupBuyService.markExpiredGroups.mockImplementation(async () => ({ affected: 0, refundOrderIds: [] }));
    groupBuyService.handleOrderCancel.mockImplementation(async () => undefined);
    merchantSettlementService.generateSalesCommission.mockImplementation(async () => undefined);
    merchantSettlementService.reconcileMissingServiceCommissions.mockImplementation(async () => ({ total: 0, created: 0, skipped: 0, failed: 0 }));
    shareService.reconcileMatureFirstPaidRewards.mockImplementation(async () => ({ total: 0, issued: 0, skipped: 0, failed: 0 }));
    benefitPackageService.reconcileTerminalRefundFreezes.mockImplementation(async () => ({ orders: 0, restored: 0, skipped: 0 }));
    benefitPackageService.reconcileUsedEntitlementAuditGaps.mockImplementation(async () => ({ total: 0, repaired: 0, failed: 0 }));

    service = new ScheduleService(
      redisService as any,
      prismaService as any,
      orderService as any,
      paymentService as any,
      paymentReconcileService as any,
      flashSaleService as any,
      groupBuyService as any,
      merchantSettlementService as any,
      shareService as any,
      benefitPackageService as any,
      schedulerRegistry as any,
    );
    jest.spyOn((service as any).logger, 'log').mockImplementation(() => {});
    jest.spyOn((service as any).logger, 'warn').mockImplementation(() => {});
    jest.spyOn((service as any).logger, 'error').mockImplementation(() => {});
  });

  it('支付对账定时任务调用 reconcilePendingPayments', async () => {
    await service.handlePaymentReconcile();
    expect(paymentReconcileService.reconcilePendingPayments).toHaveBeenCalled();
    expect(paymentService.reconcilePaidOrderSideEffects).toHaveBeenCalled();
  });

  it('退款对账同时修复失败终态遗留的权益冻结', async () => {
    await service.handleRefundReconcile();
    expect(paymentReconcileService.reconcilePendingRefunds).toHaveBeenCalled();
    expect(benefitPackageService.reconcileTerminalRefundFreezes).toHaveBeenCalled();
    expect(paymentService.reconcileRefundSuccessSideEffects).toHaveBeenCalled();
  });

  it('超时关单前会先做支付确认', async () => {
    await service.handleCloseTimeoutOrders();
    expect(paymentReconcileService.confirmTimeoutOrdersBeforeClose).toHaveBeenCalled();
    expect(orderService.closeTimeoutOrders).toHaveBeenCalled();
  });

  it('已取消订单残留的秒杀与拼团占用会被持久状态巡检修复', async () => {
    prismaService.$queryRaw
      .mockImplementationOnce(async () => [{ orderId: 11n }])
      .mockImplementationOnce(async () => [{ orderId: 12n }]);

    await service.handleCloseTimeoutOrders();

    expect(flashSaleService.handleOrderCancel).toHaveBeenCalledWith(11n);
    expect(groupBuyService.handleOrderCancel).toHaveBeenCalledWith(12n);
  });

  it('自动释放过期秒杀库存锁', async () => {
    flashSaleService.releaseExpiredLocks.mockImplementation(async () => ({ released: 2 }));

    await service.handleReleaseExpiredFlashSaleLocks();

    expect(flashSaleService.releaseExpiredLocks).toHaveBeenCalled();
    expect(redisService.releaseLockWithLua).toHaveBeenCalledWith(
      'schedule:release_expired_flash_sale_locks',
      expect.any(String),
    );
  });

  it('拼团过期后自动对已支付订单发起退款', async () => {
    groupBuyService.markExpiredGroups.mockImplementation(async () => ({
      affected: 1,
      refundOrderIds: ['123'],
    }));

    await service.handleExpiredGroupBuys();

    expect(groupBuyService.markExpiredGroups).toHaveBeenCalled();
    expect(paymentService.createGroupBuyFailureRefund).toHaveBeenCalledWith(
      '123',
      '拼团失败自动退款',
    );
    expect(redisService.releaseLockWithLua).toHaveBeenCalledWith(
      'schedule:expire_group_buys',
      expect.any(String),
    );
  });

  it('已失败拼团即使上一轮退款在建立退款记录前失败，也会被下一轮重新发现', async () => {
    groupBuyService.markExpiredGroups.mockImplementation(async () => ({
      affected: 0,
      refundOrderIds: [],
    }));
    prismaService.$queryRaw.mockImplementation(async () => [{ orderId: 987654321n }]);

    await service.handleExpiredGroupBuys();

    expect(paymentService.createGroupBuyFailureRefund).toHaveBeenCalledWith(
      '987654321',
      '拼团失败自动退款',
    );
  });

  it('新失败团与持久化扫描结果会去重，避免同一轮重复提交退款', async () => {
    groupBuyService.markExpiredGroups.mockImplementation(async () => ({
      affected: 1,
      refundOrderIds: ['123'],
    }));
    prismaService.$queryRaw.mockImplementation(async () => [{ orderId: 123n }]);

    await service.handleExpiredGroupBuys();

    expect(paymentService.createGroupBuyFailureRefund).toHaveBeenCalledTimes(1);
  });

  it('单轮拼团失败退款提交有上限，剩余订单留给下一轮持久化扫描', async () => {
    groupBuyService.markExpiredGroups.mockImplementation(async () => ({
      affected: 25,
      refundOrderIds: Array.from({ length: 25 }, (_, index) => String(index + 1)),
    }));

    await service.handleExpiredGroupBuys();

    expect(paymentService.createGroupBuyFailureRefund).toHaveBeenCalledTimes(20);
    expect(paymentService.createGroupBuyFailureRefund).toHaveBeenLastCalledWith(
      '20',
      '拼团失败自动退款',
    );
  });

  it('权益核销审计缺口和服务分佣缺口都会自动重建', async () => {
    benefitPackageService.reconcileUsedEntitlementAuditGaps.mockImplementation(async () => ({
      total: 1,
      repaired: 1,
      failed: 0,
    }));
    merchantSettlementService.reconcileMissingServiceCommissions.mockImplementation(async () => ({
      total: 1,
      created: 1,
      skipped: 0,
      failed: 0,
    }));

    await service.handleBenefitSettlementReconcile();

    expect(benefitPackageService.reconcileUsedEntitlementAuditGaps).toHaveBeenCalled();
    expect(merchantSettlementService.reconcileMissingServiceCommissions).toHaveBeenCalled();
    expect(redisService.releaseLockWithLua).toHaveBeenCalledWith(
      'schedule:benefit_settlement_reconcile',
      expect.any(String),
    );
  });

  it('成熟销售分佣只处理数据库扫描出的缺口订单，不会被已处理前200条饿死', async () => {
    prismaService.$queryRaw.mockImplementationOnce(async () => [{
      id: 301n,
      userId: 9n,
      payAmount: 1200,
      sourceType: 'merchant_referral',
      sourceCode: 'M001',
    }]);
    prismaService.merchantCommissionRecord.findFirst.mockImplementation(async () => ({ id: 77n }));

    await service.handleMatureSalesCommissions();

    expect(merchantSettlementService.generateSalesCommission).toHaveBeenCalledWith(
      301n,
      9n,
      1200,
      'merchant_referral',
      'M001',
    );
    expect(redisService.releaseLockWithLua).toHaveBeenCalledWith(
      'schedule:mature_sales_commissions',
      expect.any(String),
    );
  });

  it('按小时补偿超过售后窗口的首单邀请奖励', async () => {
    shareService.reconcileMatureFirstPaidRewards.mockImplementation(async () => ({
      total: 1,
      issued: 1,
      skipped: 0,
      failed: 0,
    }));

    await service.handleMatureReferralRewards();

    expect(shareService.reconcileMatureFirstPaidRewards).toHaveBeenCalled();
    expect(redisService.releaseLockWithLua).toHaveBeenCalledWith(
      'schedule:mature_referral_rewards',
      expect.any(String),
    );
  });

  it('长任务会在锁TTL到期前续租，并在释放后停止续租', async () => {
    jest.useFakeTimers();
    try {
      const lockValue = await (service as any).acquireLock('schedule:lease-test', 3);
      expect(lockValue).toEqual(expect.any(String));

      jest.advanceTimersByTime(1000);
      await Promise.resolve();
      await Promise.resolve();

      expect(redisService.extendLockWithLua).toHaveBeenCalledWith(
        'schedule:lease-test',
        lockValue,
        3,
      );

      await (service as any).releaseLock('schedule:lease-test', lockValue);
      const renewalCallsAfterRelease = redisService.extendLockWithLua.mock.calls.length;

      jest.advanceTimersByTime(5000);
      await Promise.resolve();
      await Promise.resolve();

      expect(redisService.extendLockWithLua).toHaveBeenCalledTimes(
        renewalCallsAfterRelease,
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('关机时停止 Cron 并等待已持有锁的任务释放后才完成', async () => {
    const lockValue = await (service as any).acquireLock('schedule:shutdown-test', 30);
    expect(lockValue).toEqual(expect.any(String));

    let shutdownCompleted = false;
    const shutdown = service.onModuleDestroy().then(() => {
      shutdownCompleted = true;
    });
    await Promise.resolve();

    expect(schedulerRegistry.stop).toHaveBeenCalledTimes(1);
    expect(shutdownCompleted).toBe(false);

    await (service as any).releaseLock('schedule:shutdown-test', lockValue);
    await shutdown;

    expect(shutdownCompleted).toBe(true);
    const setCallsBefore = redisService.setNX.mock.calls.length;
    await expect((service as any).acquireLock('schedule:after-shutdown', 30)).resolves.toBeNull();
    expect(redisService.setNX).toHaveBeenCalledTimes(setCallsBefore);
  });

  it('SIGTERM 落在 SET NX 等待期间时释放刚拿到的锁且不启动新任务', async () => {
    let resolveSetNX: (value: boolean) => void = () => undefined;
    const pendingSetNX = new Promise<boolean>((resolve) => {
      resolveSetNX = resolve;
    });
    redisService.setNX.mockImplementation(() => pendingSetNX as any);

    const acquiring = (service as any).acquireLock('schedule:in-flight', 30);
    const shutdown = service.onModuleDestroy();
    resolveSetNX(true);

    await expect(acquiring).resolves.toBeNull();
    await shutdown;
    expect(redisService.releaseLockWithLua).toHaveBeenCalledTimes(1);
    expect(redisService.releaseLockWithLua).toHaveBeenCalledWith(
      'schedule:in-flight',
      expect.any(String),
    );
  });
});
