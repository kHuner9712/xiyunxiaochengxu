import { BadRequestException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PAYMENT_STATUS } from '../common/constants';
import { ProductionOrderService } from './production-order.service';
import { CancellationSafeProductionOrderService } from './cancellation-safe-production-order.service';

describe('CancellationSafeProductionOrderService', () => {
  afterEach(() => jest.restoreAllMocks());

  function createService(payment: any) {
    const prisma: any = {
      order: {
        findUnique: jest.fn().mockResolvedValue({ status: OrderStatus.pending_payment }),
      },
      orderPayment: {
        findFirst: jest.fn().mockResolvedValue(payment),
      },
    };
    const redis: any = {
      setNX: jest.fn().mockResolvedValue(true),
      releaseLockWithLua: jest.fn().mockResolvedValue(true),
    };
    const noop: any = {};
    const service = new CancellationSafeProductionOrderService(
      prisma,
      noop,
      noop,
      noop,
      noop,
      redis,
    );
    return { service, prisma, redis };
  }

  it('blocks user cancellation while a WeChat payment is not definitively closed', async () => {
    const baseCancel = jest.spyOn(ProductionOrderService.prototype, 'cancel').mockResolvedValue({} as any);
    const { service, redis } = createService({ id: 7n, status: PAYMENT_STATUS.CREATED });

    await expect(service.cancel('8', '42')).rejects.toBeInstanceOf(BadRequestException);

    expect(baseCancel).not.toHaveBeenCalled();
    expect(redis.setNX).toHaveBeenCalledWith(
      'order:payment-cancel:42',
      expect.any(String),
      90,
    );
    expect(redis.releaseLockWithLua).toHaveBeenCalled();
  });

  it('allows cancellation under the same lock when no payment was ever initialized', async () => {
    const baseCancel = jest
      .spyOn(ProductionOrderService.prototype, 'cancel')
      .mockResolvedValue({ id: '42', status: OrderStatus.cancelled } as any);
    const { service } = createService(null);

    await service.cancel('8', '42');

    expect(baseCancel).toHaveBeenCalledWith('8', '42');
  });

  it('allows manual cancellation after WeChat has been definitively closed', async () => {
    const baseCancel = jest
      .spyOn(ProductionOrderService.prototype, 'cancel')
      .mockResolvedValue({ id: '42', status: OrderStatus.cancelled } as any);
    const { service } = createService({ id: 7n, status: PAYMENT_STATUS.FAILED });

    await service.cancel('8', '42');

    expect(baseCancel).toHaveBeenCalledWith('8', '42');
  });

  it('uses the order id as the lock target for admin cancellation', async () => {
    const baseCancel = jest
      .spyOn(ProductionOrderService.prototype, 'adminCancel')
      .mockResolvedValue({ id: '42', status: OrderStatus.cancelled } as any);
    const { service, redis } = createService(null);

    await service.adminCancel('42', '后台取消');

    expect(redis.setNX).toHaveBeenCalledWith(
      'order:payment-cancel:42',
      expect.any(String),
      90,
    );
    expect(baseCancel).toHaveBeenCalledWith('42', '后台取消');
  });

  it('timeout cancellation executes real rollback logic and closes promotion reservations in one transaction', async () => {
    const now = new Date(Date.now() - 60_000);
    const tx: any = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 42n,
          orderNo: 'O42',
          userId: 8n,
          status: OrderStatus.pending_payment,
          autoCloseAt: now,
          pointsDeducted: 100,
          couponId: 9n,
          orderItems: [
            { productId: 1n, skuId: 2n, quantity: 1 },
          ],
          payment: { status: PAYMENT_STATUS.FAILED },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      productSku: {
        findUnique: jest.fn().mockResolvedValue({ stock: 5 }),
        update: jest.fn().mockResolvedValue({}),
      },
      productStockLog: { create: jest.fn().mockResolvedValue({}) },
      user: {
        findUnique: jest.fn().mockResolvedValue({ availablePoints: 500 }),
        update: jest.fn().mockResolvedValue({}),
      },
      pointsRecord: { create: jest.fn().mockResolvedValue({}) },
      userCoupon: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      flashSaleOrder: {
        findFirst: jest.fn().mockResolvedValue({ id: 3n, activityId: 4n, quantity: 1 }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      groupBuyMember: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      orderLog: { create: jest.fn().mockResolvedValue({}) },
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    const prisma: any = {
      order: { findMany: jest.fn().mockResolvedValue([{ id: 42n }]) },
      $transaction: jest.fn(async (fn: any) => fn(tx)),
    };
    const redis: any = {
      setNX: jest.fn().mockResolvedValue(true),
      releaseLockWithLua: jest.fn().mockResolvedValue(true),
    };
    const noop: any = {};
    const service = new CancellationSafeProductionOrderService(
      prisma,
      noop,
      noop,
      noop,
      noop,
      redis,
    );

    const result = await service.closeTimeoutOrders();

    expect(result).toEqual({ closedCount: 1 });
    expect(tx.pointsRecord.create).toHaveBeenCalled();
    expect(tx.userCoupon.updateMany).toHaveBeenCalled();
    expect(tx.flashSaleOrder.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'cancelled' }) }),
    );
    expect(tx.groupBuyMember.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'cancelled' } }),
    );
    expect(tx.productStockLog.create).toHaveBeenCalled();
  });
});
