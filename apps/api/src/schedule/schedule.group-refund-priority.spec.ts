import { describe, expect, it, jest } from '@jest/globals';

jest.mock('@nestjs/schedule', () => ({
  Cron: () => () => {},
  SchedulerRegistry: class SchedulerRegistry {},
}));

import { ScheduleService } from './schedule.service';

describe('ScheduleService group-buy refund backlog priority', () => {
  it('snapshots durable backlog before expiring new groups and spends the finite batch on backlog first', async () => {
    const redisService: any = {
      setNX: jest.fn(async () => true),
      extendLockWithLua: jest.fn(async () => true),
      releaseLockWithLua: jest.fn(async () => true),
    };
    const durableRows = Array.from({ length: 25 }, (_, index) => ({
      orderId: BigInt(index + 1),
    }));
    const prismaService: any = {
      $queryRaw: jest.fn(async () => durableRows),
      merchantCommissionRecord: { findFirst: jest.fn() },
    };
    const orderService: any = {
      closeTimeoutOrders: jest.fn(),
      autoCompleteOrders: jest.fn(),
    };
    const paymentService: any = {
      createGroupBuyFailureRefund: jest.fn(async () => ({ status: 'pending' })),
      reconcilePaidOrderSideEffects: jest.fn(),
      reconcileRefundSuccessSideEffects: jest.fn(),
    };
    const paymentReconcileService: any = {
      confirmTimeoutOrdersBeforeClose: jest.fn(),
      reconcilePendingPayments: jest.fn(),
      reconcilePendingRefunds: jest.fn(),
    };
    const flashSaleService: any = {
      releaseExpiredLocks: jest.fn(),
      handleOrderCancel: jest.fn(),
    };
    const groupBuyService: any = {
      markExpiredGroups: jest.fn(async () => ({
        affected: 2,
        refundOrderIds: ['900', '901'],
      })),
      handleOrderCancel: jest.fn(),
    };
    const merchantSettlementService: any = {
      generateSalesCommission: jest.fn(),
      reconcileMissingServiceCommissions: jest.fn(),
    };
    const shareService: any = {
      reconcileMatureFirstPaidRewards: jest.fn(),
    };
    const benefitPackageService: any = {
      reconcileTerminalRefundFreezes: jest.fn(),
      reconcileUsedEntitlementAuditGaps: jest.fn(),
    };
    const schedulerRegistry: any = {
      getCronJobs: jest.fn(() => new Map()),
    };

    const service = new ScheduleService(
      redisService,
      prismaService,
      orderService,
      paymentService,
      paymentReconcileService,
      flashSaleService,
      groupBuyService,
      merchantSettlementService,
      shareService,
      benefitPackageService,
      schedulerRegistry,
    );
    jest.spyOn((service as any).logger, 'log').mockImplementation(() => {});
    jest.spyOn((service as any).logger, 'warn').mockImplementation(() => {});
    jest.spyOn((service as any).logger, 'error').mockImplementation(() => {});

    await service.handleExpiredGroupBuys();

    expect(prismaService.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      groupBuyService.markExpiredGroups.mock.invocationCallOrder[0],
    );
    expect(paymentService.createGroupBuyFailureRefund).toHaveBeenCalledTimes(20);
    expect(paymentService.createGroupBuyFailureRefund).toHaveBeenNthCalledWith(
      1,
      '1',
      '拼团失败自动退款',
    );
    expect(paymentService.createGroupBuyFailureRefund).toHaveBeenNthCalledWith(
      20,
      '20',
      '拼团失败自动退款',
    );
    expect(paymentService.createGroupBuyFailureRefund).not.toHaveBeenCalledWith(
      '900',
      '拼团失败自动退款',
    );
    expect(paymentService.createGroupBuyFailureRefund).not.toHaveBeenCalledWith(
      '901',
      '拼团失败自动退款',
    );
  });
});
