import { BadRequestException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { FlashSaleService } from './flash-sale.service';

function createFixture() {
  const txExecuteRaw = jest.fn().mockResolvedValue(1);
  const flashSaleOrderUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
  const prisma: any = {
    flashSaleActivity: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    flashSaleOrder: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
      create: jest.fn(),
      updateMany: flashSaleOrderUpdateMany,
    },
    order: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    $executeRaw: jest.fn().mockResolvedValue(1),
    $transaction: jest.fn(async (callback: any) => callback({
      flashSaleOrder: { updateMany: flashSaleOrderUpdateMany },
      $executeRaw: txExecuteRaw,
    })),
  };
  const orderService: any = {
    create: jest.fn(),
    cancel: jest.fn().mockResolvedValue({}),
  };
  const service = new FlashSaleService(prisma, orderService);
  jest.spyOn((service as any).logger, 'log').mockImplementation(() => undefined);
  jest.spyOn((service as any).logger, 'warn').mockImplementation(() => undefined);
  jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);
  jest.spyOn((service as any).logger, 'debug').mockImplementation(() => undefined);
  return { service, prisma, orderService, flashSaleOrderUpdateMany, txExecuteRaw };
}

describe('FlashSaleService lifecycle hardening', () => {
  it('does not release an expired flash lock while the ordinary order is still payable', async () => {
    const { service, prisma, flashSaleOrderUpdateMany, txExecuteRaw } = createFixture();
    prisma.flashSaleOrder.findMany.mockResolvedValue([{
      id: 1n,
      activityId: 2n,
      orderId: 3n,
      quantity: 1,
      status: 'pending_payment',
      lockExpireAt: new Date(Date.now() - 60_000),
    }]);
    prisma.order.findFirst.mockResolvedValue({ status: OrderStatus.pending_payment });

    const result = await service.releaseExpiredLocks();

    expect(result).toEqual({ released: 0, deferred: 1, settled: 0, failed: 0 });
    expect(flashSaleOrderUpdateMany).not.toHaveBeenCalled();
    expect(txExecuteRaw).not.toHaveBeenCalled();
  });

  it('settles the flash side instead of releasing inventory when the ordinary order is paid', async () => {
    const { service, prisma, flashSaleOrderUpdateMany, txExecuteRaw } = createFixture();
    const fsOrder = {
      id: 11n,
      activityId: 12n,
      orderId: 13n,
      quantity: 2,
      status: 'pending_payment',
      lockExpireAt: new Date(Date.now() - 60_000),
    };
    prisma.flashSaleOrder.findMany.mockResolvedValue([fsOrder]);
    prisma.order.findFirst.mockResolvedValue({ status: OrderStatus.pending_delivery });
    prisma.flashSaleOrder.findFirst.mockResolvedValue(fsOrder);

    const result = await service.releaseExpiredLocks();

    expect(result).toEqual({ released: 0, deferred: 0, settled: 1, failed: 0 });
    expect(flashSaleOrderUpdateMany).toHaveBeenCalledWith({
      where: { id: 11n, status: 'pending_payment' },
      data: expect.objectContaining({ status: 'paid' }),
    });
    expect(txExecuteRaw).toHaveBeenCalledTimes(1);
  });

  it('releases an expired lock only after the ordinary order is cancelled', async () => {
    const { service, prisma, flashSaleOrderUpdateMany, txExecuteRaw } = createFixture();
    prisma.flashSaleOrder.findMany.mockResolvedValue([{
      id: 21n,
      activityId: 22n,
      orderId: 23n,
      quantity: 1,
      status: 'pending_payment',
      lockExpireAt: new Date(Date.now() - 60_000),
    }]);
    prisma.order.findFirst.mockResolvedValue({ status: OrderStatus.cancelled });

    const result = await service.releaseExpiredLocks();

    expect(result).toEqual({ released: 1, deferred: 0, settled: 0, failed: 0 });
    expect(flashSaleOrderUpdateMany).toHaveBeenCalledWith({
      where: { id: 21n, status: 'pending_payment' },
      data: expect.objectContaining({ status: 'expired' }),
    });
    expect(txExecuteRaw).toHaveBeenCalledTimes(1);
  });

  it('aligns the ordinary order auto-close deadline with the flash lock deadline', async () => {
    const { service, prisma, orderService } = createFixture();
    const activityId = 9007199254740993n;
    const orderId = 9007199254740997n;
    prisma.flashSaleActivity.findFirst.mockResolvedValue({
      id: activityId,
      name: '秒杀活动',
      skuId: 9007199254740995n,
      status: 1,
      startTime: new Date(Date.now() - 60_000),
      endTime: new Date(Date.now() + 60 * 60_000),
      limitPerUser: 0,
      lockMinutes: 15,
      flashPrice: 990,
    });
    prisma.order.updateMany.mockResolvedValue({ count: 1 });
    prisma.flashSaleOrder.create.mockResolvedValue({ id: 31n });
    orderService.create.mockResolvedValue({
      orderId: orderId.toString(),
      isZeroPay: false,
    });

    const result = await service.weappBuy('41', {
      activityId: activityId.toString(),
      quantity: 1,
      addressId: '51',
      fulfillmentType: 'delivery',
    });

    expect(orderService.create).toHaveBeenCalledWith('41', expect.objectContaining({
      addressId: '51',
      fulfillmentType: 'delivery',
      items: [{ skuId: '9007199254740995', quantity: 1, priceOverride: 990 }],
    }));
    expect(prisma.order.updateMany).toHaveBeenCalledWith({
      where: {
        id: orderId,
        userId: 41n,
        status: OrderStatus.pending_payment,
      },
      data: { autoCloseAt: expect.any(Date) },
    });
    const autoCloseAt = prisma.order.updateMany.mock.calls[0][0].data.autoCloseAt as Date;
    expect(result.lockExpireAt).toBe(autoCloseAt.toISOString());
    expect(result.orderId).toBe(orderId.toString());
  });

  it('rejects signed BIGINT overflow before Prisma receives the activity id', async () => {
    const { service, prisma } = createFixture();

    await expect(service.weappFindActivityById('9223372036854775808'))
      .rejects.toEqual(new BadRequestException('活动ID超出范围'));

    expect(prisma.flashSaleActivity.findFirst).not.toHaveBeenCalled();
  });
});
