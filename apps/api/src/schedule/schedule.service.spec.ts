import { describe, it, expect, jest, beforeEach } from '@jest/globals';
jest.mock('@nestjs/schedule', () => ({ Cron: () => () => {} }));
import { ScheduleService } from './schedule.service';

function createRedisService() {
  return {
    setNX: jest.fn(),
    releaseLockWithLua: jest.fn(),
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
  };
}

function createGroupBuyService() {
  return {
    markExpiredGroups: jest.fn(),
  };
}

function createMerchantSettlementService() {
  return {
    generateMatureSalesCommissions: jest.fn(),
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
  };
}

describe('ScheduleService', () => {
  let service: ScheduleService;
  let redisService: ReturnType<typeof createRedisService>;
  let orderService: ReturnType<typeof createOrderService>;
  let paymentService: ReturnType<typeof createPaymentService>;
  let paymentReconcileService: ReturnType<typeof createPaymentReconcileService>;
  let flashSaleService: ReturnType<typeof createFlashSaleService>;
  let groupBuyService: ReturnType<typeof createGroupBuyService>;
  let merchantSettlementService: ReturnType<typeof createMerchantSettlementService>;
  let shareService: ReturnType<typeof createShareService>;
  let benefitPackageService: ReturnType<typeof createBenefitPackageService>;

  beforeEach(() => {
    redisService = createRedisService();
    orderService = createOrderService();
    paymentService = createPaymentService();
    paymentReconcileService = createPaymentReconcileService();
    flashSaleService = createFlashSaleService();
    groupBuyService = createGroupBuyService();
    merchantSettlementService = createMerchantSettlementService();
    shareService = createShareService();
    benefitPackageService = createBenefitPackageService();
    redisService.setNX.mockImplementation(async () => true);
    redisService.releaseLockWithLua.mockImplementation(async () => true);
    orderService.closeTimeoutOrders.mockImplementation(async () => ({ closedCount: 0 }));
    paymentService.createGroupBuyFailureRefund.mockImplementation(async () => ({ status: 'pending' }));
    paymentReconcileService.confirmTimeoutOrdersBeforeClose.mockImplementation(async () => ({ total: 0, fixed: 0, delayed: 0, closable: 0, failed: 0 }));
    paymentReconcileService.reconcilePendingPayments.mockImplementation(async () => ({ total: 0, fixed: 0, skipped: 0, failed: 0 }));
    paymentReconcileService.reconcilePendingRefunds.mockImplementation(async () => ({ total: 0, fixed: 0, skipped: 0, failed: 0 }));
    flashSaleService.releaseExpiredLocks.mockImplementation(async () => ({ released: 0 }));
    groupBuyService.markExpiredGroups.mockImplementation(async () => ({ affected: 0, refundOrderIds: [] }));
    merchantSettlementService.generateMatureSalesCommissions.mockImplementation(async () => ({ total: 0, generated: 0, skipped: 0, failed: 0 }));
    shareService.reconcileMatureFirstPaidRewards.mockImplementation(async () => ({ total: 0, issued: 0, skipped: 0, failed: 0 }));
    benefitPackageService.reconcileTerminalRefundFreezes.mockImplementation(async () => ({ orders: 0, restored: 0, skipped: 0 }));

    service = new ScheduleService(
      redisService as any,
      orderService as any,
      paymentService as any,
      paymentReconcileService as any,
      flashSaleService as any,
      groupBuyService as any,
      merchantSettlementService as any,
      shareService as any,
      benefitPackageService as any,
    );
    jest.spyOn((service as any).logger, 'log').mockImplementation(() => {});
    jest.spyOn((service as any).logger, 'error').mockImplementation(() => {});
  });

  it('支付对账定时任务调用 reconcilePendingPayments', async () => {
    await service.handlePaymentReconcile();
    expect(paymentReconcileService.reconcilePendingPayments).toHaveBeenCalled();
  });

  it('退款对账同时修复失败终态遗留的权益冻结', async () => {
    await service.handleRefundReconcile();
    expect(paymentReconcileService.reconcilePendingRefunds).toHaveBeenCalled();
    expect(benefitPackageService.reconcileTerminalRefundFreezes).toHaveBeenCalled();
  });

  it('超时关单前会先做支付确认', async () => {
    await service.handleCloseTimeoutOrders();
    expect(paymentReconcileService.confirmTimeoutOrdersBeforeClose).toHaveBeenCalled();
    expect(orderService.closeTimeoutOrders).toHaveBeenCalled();
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

  it('按小时生成超过售后窗口的销售分佣', async () => {
    merchantSettlementService.generateMatureSalesCommissions.mockImplementation(async () => ({
      total: 2,
      generated: 2,
      skipped: 0,
      failed: 0,
    }));

    await service.handleMatureSalesCommissions();

    expect(merchantSettlementService.generateMatureSalesCommissions).toHaveBeenCalled();
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
});
