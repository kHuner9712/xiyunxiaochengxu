import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DurableAdminIdempotentBigintSafeProductionGroupBuyService } from './durable-admin-idempotent-bigint-safe-production-group-buy.service';

function futureIso(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function activityInput(overrides: Record<string, unknown> = {}) {
  return {
    name: '3人拼团',
    productId: '11',
    skuId: '22',
    groupPrice: 9900,
    groupSize: 3,
    groupExpireHours: 24,
    startTime: futureIso(1),
    endTime: futureIso(48),
    status: 1,
    clientRequestId: '9001001',
    ...overrides,
  } as any;
}

describe('DurableAdminIdempotentBigintSafeProductionGroupBuyService', () => {
  function setup() {
    const tx = {
      businessEvent: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      groupBuyActivity: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      productSku: {
        findFirst: jest.fn(),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
    } as any;
    const prisma = {
      $transaction: jest.fn(async (callback: any) => callback(tx)),
      groupBuyActivity: {
        findFirst: jest.fn(),
      },
    } as any;
    const service = new DurableAdminIdempotentBigintSafeProductionGroupBuyService(
      prisma,
      {} as any,
      {} as any,
      {} as any,
    );
    return { service, prisma, tx };
  }

  it('replays a committed create before checking current SKU state', async () => {
    const { service, tx } = setup();
    tx.businessEvent.findFirst.mockResolvedValueOnce(null);
    tx.productSku.findFirst.mockResolvedValueOnce({
      id: 22n,
      productId: 11n,
      price: 12000,
      product: { status: 1, fulfillmentType: 'delivery' },
    });
    tx.groupBuyActivity.create.mockResolvedValueOnce({ id: 101n, deletedAt: null });

    const dto = activityInput();
    await expect(service.createActivity(dto)).resolves.toMatchObject({ id: 101n });
    const payload = tx.businessEvent.create.mock.calls[0][0].data.payload;

    tx.businessEvent.findFirst.mockResolvedValueOnce({ payload });
    tx.groupBuyActivity.findUnique.mockResolvedValueOnce({ id: 101n, deletedAt: null });
    await expect(service.createActivity({ ...dto })).resolves.toMatchObject({ id: 101n });

    expect(tx.groupBuyActivity.create).toHaveBeenCalledTimes(1);
    expect(tx.productSku.findFirst).toHaveBeenCalledTimes(1);
  });

  it('rejects a changed payload that reuses an already handled request id', async () => {
    const { service, tx } = setup();
    tx.businessEvent.findFirst.mockResolvedValueOnce(null);
    tx.productSku.findFirst.mockResolvedValueOnce({
      id: 22n,
      productId: 11n,
      price: 12000,
      product: { status: 1, fulfillmentType: 'delivery' },
    });
    tx.groupBuyActivity.create.mockResolvedValueOnce({ id: 102n, deletedAt: null });

    const dto = activityInput();
    await service.createActivity(dto);
    const payload = tx.businessEvent.create.mock.calls[0][0].data.payload;
    tx.businessEvent.findFirst.mockResolvedValueOnce({ payload });

    await expect(service.createActivity({ ...dto, name: '另一个活动' })).rejects.toThrow(
      '拼团活动创建请求ID已被其他操作使用',
    );
    expect(tx.groupBuyActivity.create).toHaveBeenCalledTimes(1);
  });

  it('rejects an expired activity that is created directly as enabled', async () => {
    const { service, tx } = setup();
    tx.businessEvent.findFirst.mockResolvedValueOnce(null);
    await expect(service.createActivity(activityInput({
      startTime: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      status: 1,
    }))).rejects.toThrow('上架拼团活动的结束时间必须晚于当前时间');
    expect(tx.groupBuyActivity.create).not.toHaveBeenCalled();
  });

  it('treats an already soft-deleted activity as a successful delete replay', async () => {
    const { service, tx } = setup();
    tx.groupBuyActivity.findUnique.mockResolvedValueOnce({ id: 103n, deletedAt: new Date() });
    await expect(service.deleteActivity('103')).resolves.toEqual({ success: true });
    expect(tx.groupBuyActivity.update).not.toHaveBeenCalled();

    tx.groupBuyActivity.findUnique.mockResolvedValueOnce(null);
    await expect(service.deleteActivity('104')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a SKU that does not belong to the selected product', async () => {
    const { service, tx } = setup();
    tx.businessEvent.findFirst.mockResolvedValueOnce(null);
    tx.productSku.findFirst.mockResolvedValueOnce({
      id: 22n,
      productId: 99n,
      price: 12000,
      product: { status: 1, fulfillmentType: 'delivery' },
    });
    await expect(service.createActivity(activityInput())).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.groupBuyActivity.create).not.toHaveBeenCalled();
  });
});
