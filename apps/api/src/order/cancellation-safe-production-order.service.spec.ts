import { BadRequestException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PAYMENT_STATUS } from '../common/constants';
import { CancellationSafeProductionOrderService } from './cancellation-safe-production-order.service';

describe('CancellationSafeProductionOrderService', () => {
  afterEach(() => jest.restoreAllMocks());

  function createManualCancelService(
    payment: any,
    promotion: { flashSaleOrder?: any } = {},
  ) {
    const cancelledOrder = {
      id: 42n,
      orderNo: 'O42',
      userId: 8n,
      status: OrderStatus.cancelled,
      pointsDeducted: 0,
      couponId: null,
      orderItems: [],
    };
    const tx: any = {
      order: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirst: jest.fn().mockResolvedValue(cancelledOrder),
      },
      flashSaleOrder: {
        findFirst: jest.fn().mockResolvedValue(promotion.flashSaleOrder ?? null),
        updateMany: jest.fn().mockResolvedValue({ count: promotion.flashSaleOrder ? 1 : 0 }),
      },
      groupBuyMember: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      orderLog: { create: jest.fn().mockResolvedValue({}) },
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    const prisma: any = {
      order: {
        findUnique: jest.fn().mockResolvedValue({ status: OrderStatus.pending_payment }),
        findFirst: jest.fn().mockResolvedValue({
          id: 42n,
          orderNo: 'O42',
          userId: 8n,
          status: OrderStatus.pending_payment,
          pointsDeducted: 0,
          couponId: null,
          orderItems: [],
        }),
      },
      orderPayment: {
        findFirst: jest.fn().mockResolvedValue(payment),
      },
      $transaction: jest.fn(async (fn: any) => fn(tx)),
    };
    const redis: any = {
      setNX: jest.fn().mockResolvedValue(true),
      releaseLockWithLua: jest.fn().mockResolvedValue(true),
    };
    const groupBuyService: any = { handleOrderCancel: jest.fn() };
    const flashSaleService: any = { handleOrderCancel: jest.fn() };
    const noop: any = {};
    const service = new CancellationSafeProductionOrderService(
      prisma,
      noop,
      noop,
      groupBuyService,
      flashSaleService,
      redis,
    );
    return { service, prisma, tx, redis, groupBuyService, flashSaleService };
  }

  it('blocks user cancellation while a WeChat payment is not definitively closed', async () => {
    const { service, prisma, redis } = createManualCancelService({
      id: 7n,
      status: PAYMENT_STATUS.CREATED,
    });

    await expect(service.cancel('8', '42')).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(redis.setNX).toHaveBeenCalledWith(
      'order:payment-cancel:42',
      expect.any(String),
      90,
    );
    expect(redis.releaseLockWithLua).toHaveBeenCalled();
  });

  it('cancels under the same lock when no payment was ever initialized', async () => {
    const { service, prisma, tx } = createManualCancelService(null);

    const result = await service.cancel('8', '42');

    expect(result.status).toBe(OrderStatus.cancelled);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 42n,
          userId: 8n,
          status: OrderStatus.pending_payment,
        }),
      }),
    );
  });

  it('allows manual cancellation after WeChat has been definitively closed', async () => {
    const { service, prisma } = createManualCancelService({
      id: 7n,
      status: PAYMENT_STATUS.FAILED,
    });

    await service.cancel('8', '42');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('uses the order id as the lock target for admin cancellation', async () => {
    const { service, tx, redis } = createManualCancelService(null);

    await service.adminCancel('42', '后台取消');

    expect(redis.setNX).toHaveBeenCalledWith(
      'order:payment-cancel:42',
      expect.any(String),
      90,
    );
    expect(tx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 42n, status: OrderStatus.pending_payment }),
        data: expect.objectContaining({ cancelReason: '后台取消' }),
      }),
    );
  });

  it('releases flash-sale and group-buy reservations inside the manual cancellation transaction', async () => {
    const flashSaleOrder = { id: 3n, activityId: 4n, quantity: 2 };
    const { service, tx, groupBuyService, flashSaleService } = createManualCancelService(
      null,
      { flashSaleOrder },
    );

    await service.cancel('8', '42');

    expect(tx.flashSaleOrder.updateMany).toHaveBeenCalledWith({
      where: { id: 3n, status: 'pending_payment' },
      data: { status: 'cancelled', cancelledAt: expect.any(Date) },
    });
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.groupBuyMember.updateMany).toHaveBeenCalledWith({
      where: { orderId: 42n, status: 'pending_payment', deletedAt: null },
      data: { status: 'cancelled' },
    });
    expect(groupBuyService.handleOrderCancel).not.toHaveBeenCalled();
    expect(flashSaleService.handleOrderCancel).not.toHaveBeenCalled();
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
        findUnique: jest.fn().mockResolvedValue({ id: 2n }),
        update: jest.fn().mockResolvedValue({ stock: 6 }),
      },
      productStockLog: { create: jest.fn().mockResolvedValue({}) },
      user: {
        update: jest.fn().mockResolvedValue({ availablePoints: 600 }),
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
    expect(tx.pointsRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ balance: 600, source: 'order_auto_close' }),
    });
    expect(tx.userCoupon.updateMany).toHaveBeenCalled();
    expect(tx.flashSaleOrder.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'cancelled' }) }),
    );
    expect(tx.groupBuyMember.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'cancelled' } }),
    );
    expect(tx.productStockLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ beforeStock: 5, afterStock: 6 }),
    });
  });
});
