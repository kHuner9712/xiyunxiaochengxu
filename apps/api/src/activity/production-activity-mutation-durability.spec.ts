import { ProductionActivityService } from './production-activity.service';

const REQUEST_ID = '1760000000000000001';

function activity(overrides: Record<string, any> = {}) {
  return {
    id: 10n,
    name: '限时活动',
    type: '1',
    description: null,
    rules: {},
    bannerImage: null,
    startTime: new Date('2026-08-14T00:00:00.000Z'),
    endTime: new Date('2026-08-20T00:00:00.000Z'),
    status: 1,
    sortOrder: 0,
    activityProducts: [],
    ...overrides,
  };
}

function createHarness() {
  let event: any = null;
  const current = activity();
  const tx: any = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: 10n }]),
    businessEvent: {
      findFirst: jest.fn(async ({ where }: any) => {
        if (where.eventType === 'activity_create' && where.bizId === REQUEST_ID) return event;
        if (where.eventType === 'activity_product_remove') return event;
        return null;
      }),
      create: jest.fn(async ({ data }: any) => {
        event = { id: 90n, ...data };
        return event;
      }),
    },
    activity: {
      create: jest.fn().mockResolvedValue(current),
      findUnique: jest.fn().mockResolvedValue(current),
      findFirst: jest.fn().mockResolvedValue(current),
      update: jest.fn().mockResolvedValue(current),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    activityProduct: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue({ id: 77n, activityId: 10n, productId: 20n, skuId: 30n }),
      create: jest.fn(),
      delete: jest.fn().mockResolvedValue({ id: 77n }),
      deleteMany: jest.fn(),
    },
    product: {
      findFirst: jest.fn().mockResolvedValue({ id: 20n, status: 1, minPrice: 1000 }),
    },
    productSku: {
      findFirst: jest.fn().mockResolvedValue({ id: 30n, productId: 20n, status: 1, price: 1000, stock: 20 }),
    },
  };
  const prisma: any = {
    ...tx,
    $transaction: jest.fn(async (callback: any) => callback(tx)),
  };
  const service = new ProductionActivityService(prisma);
  return { service, prisma, tx, current, getEvent: () => event };
}

describe('ProductionActivityService mutation durability', () => {
  it('replays one logical activity create without duplicating activity products', async () => {
    const { service, prisma, tx } = createHarness();
    const input = {
      name: '限时活动',
      type: '1',
      startTime: '2026-08-14T00:00:00.000Z',
      endTime: '2026-08-20T00:00:00.000Z',
      products: [{ productId: '20', skuId: '30', activityPrice: 900, activityStock: 10 }],
      clientRequestId: REQUEST_ID,
    };

    const first: any = await service.create(input);
    const retry: any = await service.create(input);

    expect(first.id).toBe('10');
    expect(retry.id).toBe('10');
    expect(tx.activity.create).toHaveBeenCalledTimes(1);
    expect(tx.activityProduct.createMany).toHaveBeenCalledTimes(1);
    expect(tx.businessEvent.create).toHaveBeenCalledTimes(1);
    expect(tx.businessEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: 'activity_create',
        bizType: 'activity',
        bizId: REQUEST_ID,
        payload: expect.objectContaining({ activityId: '10' }),
      }),
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'Serializable' },
    );
  });

  it('fails closed when the same create request id is reused with changed activity data', async () => {
    const { service, tx } = createHarness();
    const input = {
      name: '限时活动',
      type: '1',
      startTime: '2026-08-14T00:00:00.000Z',
      endTime: '2026-08-20T00:00:00.000Z',
      products: [{ productId: '20', skuId: '30', activityPrice: 900, activityStock: 10 }],
      clientRequestId: REQUEST_ID,
    };
    await service.create(input);

    await expect(service.create({ ...input, name: '已修改活动' })).rejects.toThrow(
      '活动创建请求ID已被其他操作使用',
    );
    expect(tx.activity.create).toHaveBeenCalledTimes(1);
  });

  it('uses a status CAS so a deleted activity cannot be resurrected by stale status updates', async () => {
    const { service, prisma } = createHarness();
    prisma.activity.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(service.updateStatus('10', 1)).rejects.toThrow('活动不存在');

    expect(prisma.activity.updateMany).toHaveBeenCalledWith({
      where: { id: 10n, status: { not: 4 } },
      data: { status: 1 },
    });
    expect(prisma.activity.update).not.toHaveBeenCalled();
  });

  it('replays success when delete already committed and the activity remains status 4', async () => {
    const { service, prisma } = createHarness();
    prisma.activity.updateMany.mockResolvedValueOnce({ count: 0 });
    prisma.activity.findUnique.mockResolvedValueOnce({ id: 10n, status: 4 });

    await expect(service.delete('10')).resolves.toEqual({ success: true, id: '10' });
  });

  it('replays a committed hard activity-product removal through its durable event', async () => {
    const { service, tx } = createHarness();

    await expect(service.removeProduct('77')).resolves.toEqual({ success: true });
    await expect(service.removeProduct('77')).resolves.toEqual({ success: true });

    expect(tx.activityProduct.delete).toHaveBeenCalledTimes(1);
    expect(tx.businessEvent.create).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
  });
});
