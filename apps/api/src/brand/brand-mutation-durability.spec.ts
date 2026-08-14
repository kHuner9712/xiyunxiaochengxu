import { BrandService } from './brand.service';

const REQUEST_ID = '1760000000000000001';

function brand(overrides: Record<string, any> = {}) {
  return {
    id: 10n,
    name: '品牌A',
    logo: 'https://example.com/a.png',
    description: '品牌描述',
    sortOrder: 0,
    status: 1,
    createdAt: new Date('2026-08-14T00:00:00.000Z'),
    updatedAt: new Date('2026-08-14T00:00:00.000Z'),
    deletedAt: null,
    ...overrides,
  };
}

function createHarness() {
  let createEvent: any = null;
  const currentBrand = brand();
  const tx: any = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: 10n }]),
    brand: {
      findFirst: jest.fn(async ({ where }: any) => {
        if (where.id !== undefined) return currentBrand;
        return null;
      }),
      create: jest.fn().mockResolvedValue(currentBrand),
      update: jest.fn().mockResolvedValue(currentBrand),
    },
    product: { count: jest.fn().mockResolvedValue(0) },
    businessEvent: {
      findFirst: jest.fn(async () => createEvent),
      create: jest.fn(async ({ data }: any) => {
        createEvent = { id: 90n, ...data };
        return createEvent;
      }),
    },
  };
  const prisma: any = {
    $transaction: jest.fn(async (callback: any) => callback(tx)),
  };
  const service = new BrandService(prisma);
  jest.spyOn(service['logger'], 'log').mockImplementation(() => {});
  return { service, prisma, tx, currentBrand };
}

describe('BrandService production mutation durability', () => {
  afterEach(() => jest.restoreAllMocks());

  it('replays a committed create request and inserts the brand once', async () => {
    const { service, prisma, tx } = createHarness();
    const input = {
      name: '品牌A',
      logo: 'https://example.com/a.png',
      description: '品牌描述',
      sortOrder: 0,
      clientRequestId: REQUEST_ID,
    };

    const first: any = await service.create(input);
    const retry: any = await service.create(input);

    expect(first.id).toBe('10');
    expect(retry.id).toBe('10');
    expect(tx.brand.create).toHaveBeenCalledTimes(1);
    expect(tx.businessEvent.create).toHaveBeenCalledTimes(1);
    expect(tx.businessEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: 'brand_create',
        bizType: 'brand',
        bizId: REQUEST_ID,
        payload: expect.objectContaining({ brandId: '10' }),
      }),
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'Serializable' },
    );
  });

  it('fails closed when a create request id is reused with changed brand data', async () => {
    const { service, tx } = createHarness();

    await service.create({ name: '品牌A', clientRequestId: REQUEST_ID });

    await expect(service.create({
      name: '品牌B',
      clientRequestId: REQUEST_ID,
    })).rejects.toThrow('品牌创建请求ID已被其他操作使用');
    expect(tx.brand.create).toHaveBeenCalledTimes(1);
  });

  it('serializes rename uniqueness checks and retries a write conflict', async () => {
    const { service, prisma, tx, currentBrand } = createHarness();
    tx.brand.findFirst.mockImplementation(async ({ where }: any) => {
      if (where.id !== undefined) return currentBrand;
      if (where.name === '品牌B') return null;
      return null;
    });
    tx.brand.update.mockResolvedValue({ ...currentBrand, name: '品牌B' });
    const execute = prisma.$transaction.getMockImplementation();
    prisma.$transaction
      .mockRejectedValueOnce(Object.assign(new Error('write conflict'), { code: 'P2034' }))
      .mockImplementation(execute!);

    const result: any = await service.update('10', { name: '品牌B' });

    expect(result.name).toBe('品牌B');
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(prisma.$transaction).toHaveBeenLastCalledWith(
      expect.any(Function),
      { isolationLevel: 'Serializable' },
    );
    expect(tx.brand.update).toHaveBeenCalledTimes(1);
  });

  it('replays success for a brand already soft-deleted', async () => {
    const { service, tx, currentBrand } = createHarness();
    currentBrand.deletedAt = new Date('2026-08-14T01:00:00.000Z');

    const result: any = await service.delete('10');

    expect(result.id).toBe('10');
    expect(tx.product.count).not.toHaveBeenCalled();
    expect(tx.brand.update).not.toHaveBeenCalled();
  });

  it('keeps an unknown brand id fail-closed on delete', async () => {
    const { service, tx } = createHarness();
    tx.$queryRaw.mockResolvedValueOnce([]);

    await expect(service.delete('999')).rejects.toThrow('品牌不存在');

    expect(tx.brand.update).not.toHaveBeenCalled();
  });
});
