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

describe('ScheduleService', () => {
  let service: ScheduleService;
  let redisService: ReturnType<typeof createRedisService>;
  let orderService: ReturnType<typeof createOrderService>;
  let paymentReconcileService: ReturnType<typeof createPaymentReconcileService>;
  let flashSaleService: ReturnType<typeof createFlashSaleService>;

  beforeEach(() => {
    redisService = createRedisService();
    orderService = createOrderService();
    paymentReconcileService = createPaymentReconcileService();
    flashSaleService = createFlashSaleService();
    redisService.setNX.mockImplementation(async () => true);
    redisService.releaseLockWithLua.mockImplementation(async () => true);
    orderService.closeTimeoutOrders.mockImplementation(async () => ({ closedCount: 0 }));
    paymentReconcileService.confirmTimeoutOrdersBeforeClose.mockImplementation(async () => ({ total: 0, fixed: 0, delayed: 0, closable: 0, failed: 0 }));
    paymentReconcileService.reconcilePendingPayments.mockImplementation(async () => ({ total: 0, fixed: 0, skipped: 0, failed: 0 }));
    paymentReconcileService.reconcilePendingRefunds.mockImplementation(async () => ({ total: 0, fixed: 0, skipped: 0, failed: 0 }));
    flashSaleService.releaseExpiredLocks.mockImplementation(async () => ({ released: 0 }));

    service = new ScheduleService(
      redisService as any,
      orderService as any,
      paymentReconcileService as any,
      flashSaleService as any,
    );
    jest.spyOn((service as any).logger, 'log').mockImplementation(() => {});
    jest.spyOn((service as any).logger, 'error').mockImplementation(() => {});
  });

  it('支付对账定时任务调用 reconcilePendingPayments', async () => {
    await service.handlePaymentReconcile();
    expect(paymentReconcileService.reconcilePendingPayments).toHaveBeenCalled();
  });

  it('退款对账定时任务调用 reconcilePendingRefunds', async () => {
    await service.handleRefundReconcile();
    expect(paymentReconcileService.reconcilePendingRefunds).toHaveBeenCalled();
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
});
