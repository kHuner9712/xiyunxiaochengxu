import { DurableAdminCouponService } from './durable-admin-coupon.service';

const REQUEST_ID = '1760000000000000001';

function coupon(overrides: Record<string, any> = {}) {
  return {
    id: 10n,
    name: '测试券',
    type: 1,
    value: 1000,
    minAmount: 5000,
    discountLimit: 0,
    totalCount: 100,
    receivedCount: 0,
    usedCount: 0,
    perLimit: 1,
    startTime: new Date('2026-08-14T00:00:00.000Z'),
    endTime: new Date('2026-08-20T00:00:00.000Z'),
    validDays: 0,
    applicableType: 0,
    applicableIds: { ids: [], description: '' },
    memberLevelId: null,
    isNewUser: 0,
    status: 1,
    createdAt: new Date('2026-08-14T00:00:00.000Z'),
    updatedAt: new Date('2026-08-14T00:00:00.000Z'),
    ...overrides,
  };
}

function createHarness() {
  let event: any = null;
  let exists = true;
  const current = coupon();
  const tx: any = {
    $queryRaw: jest.fn(async () => exists ? [{ id: 10n }] : []),
    businessEvent: {
      findFirst: jest.fn(async ({ where }: any) => {
        if (!event) return null;
        if (event.eventType !== where.eventType || event.bizId !== where.bizId) return null;
        return event;
      }),
      create: jest.fn(async ({ data }: any) => {
        event = { id: 90n, ...data };
        return event;
      }),
    },
    coupon: {
      create: jest.fn().mockResolvedValue(current),
      findUnique: jest.fn(async () => exists ? current : null),
      update: jest.fn(async ({ data }: any) => Object.assign(current, data)),
      delete: jest.fn(async () => {
        exists = false;
        return current;
      }),
    },
    userCoupon: { count: jest.fn().mockResolvedValue(0) },
    productCategory: { count: jest.fn().mockResolvedValue(0) },
    product: { count: jest.fn().mockResolvedValue(0) },
  };
  const prisma: any = {
    ...tx,
    $transaction: jest.fn(async (callback: any) => callback(tx)),
  };
  const redis: any = {};
  const service = new DurableAdminCouponService(prisma, redis);
  return { service, prisma, tx, current, setExists: (value: boolean) => { exists = value; } };
}

describe('DurableAdminCouponService', () => {
  it('replays one logical coupon create without a duplicate coupon row', async () => {
    const { service, prisma, tx } = createHarness();
    const input = {
      name: '测试券',
      type: 1,
      value: 1000,
      minAmount: 5000,
      startTime: '2026-08-14T00:00:00.000Z',
      endTime: '2026-08-20T00:00:00.000Z',
      clientRequestId: REQUEST_ID,
    };

    const first: any = await service.create(input);
    const retry: any = await service.create(input);

    expect(first.id).toBe('10');
    expect(retry.id).toBe('10');
    expect(tx.coupon.create).toHaveBeenCalledTimes(1);
    expect(tx.businessEvent.create).toHaveBeenCalledTimes(1);
    expect(tx.businessEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: 'coupon_create',
        bizType: 'coupon',
        bizId: REQUEST_ID,
        payload: expect.objectContaining({ couponId: '10' }),
      }),
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'Serializable' },
    );
  });

  it('fails closed when a create request id is reused with changed coupon terms', async () => {
    const { service, tx } = createHarness();
    const input = {
      name: '测试券',
      type: 1,
      value: 1000,
      minAmount: 5000,
      startTime: '2026-08-14T00:00:00.000Z',
      endTime: '2026-08-20T00:00:00.000Z',
      clientRequestId: REQUEST_ID,
    };
    await service.create(input);

    await expect(service.create({ ...input, value: 1200 })).rejects.toThrow(
      '优惠券创建请求ID已被其他操作使用',
    );
    expect(tx.coupon.create).toHaveBeenCalledTimes(1);
  });

  it('replays a committed hard delete through a durable coupon snapshot', async () => {
    const { service, tx } = createHarness();

    const first: any = await service.delete('10');
    const retry: any = await service.delete('10');

    expect(first).toMatchObject({ id: '10', deleted: true, name: '测试券' });
    expect(retry).toMatchObject({ id: '10', deleted: true, name: '测试券' });
    expect(tx.coupon.delete).toHaveBeenCalledTimes(1);
    expect(tx.businessEvent.create).toHaveBeenCalledTimes(1);
  });

  it('keeps issued coupons as disabled records instead of hard deleting them', async () => {
    const { service, tx, current } = createHarness();
    tx.userCoupon.count.mockResolvedValue(3);

    const result: any = await service.delete('10');

    expect(result.deleted).toBe(false);
    expect(current.status).toBe(0);
    expect(tx.coupon.delete).not.toHaveBeenCalled();
    expect(tx.businessEvent.create).not.toHaveBeenCalled();
  });
});
