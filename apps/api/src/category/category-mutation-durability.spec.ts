import { CategoryService } from './category.service';

const REQUEST_ID = '1760000000000000001';

function category(overrides: Record<string, any> = {}) {
  return {
    id: 10n,
    parentId: 0n,
    name: '一级分类',
    icon: null,
    complianceConfig: null,
    sortOrder: 0,
    isShow: 1,
    createdAt: new Date('2026-08-14T00:00:00.000Z'),
    updatedAt: new Date('2026-08-14T00:00:00.000Z'),
    deletedAt: null as Date | null,
    ...overrides,
  };
}

function createHarness() {
  let createEvent: any = null;
  const currentCategory = category();
  const tx: any = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: 10n, parentId: 0n }]),
    productCategory: {
      findFirst: jest.fn(async ({ where }: any) => {
        if (typeof where.id === 'bigint') return currentCategory;
        return null;
      }),
      create: jest.fn().mockResolvedValue(currentCategory),
      update: jest.fn().mockResolvedValue(currentCategory),
      count: jest.fn().mockResolvedValue(0),
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
  const service = new CategoryService(prisma);
  jest.spyOn(service['logger'], 'log').mockImplementation(() => {});
  return { service, prisma, tx, currentCategory };
}

describe('CategoryService mutation durability', () => {
  afterEach(() => jest.restoreAllMocks());

  it('replays a committed create request and inserts one category', async () => {
    const { service, prisma, tx } = createHarness();
    const input = {
      name: '一级分类',
      parentId: '0',
      clientRequestId: REQUEST_ID,
    };

    const first: any = await service.create(input);
    const retry: any = await service.create(input);

    expect(first.id).toBe('10');
    expect(retry.id).toBe('10');
    expect(tx.productCategory.create).toHaveBeenCalledTimes(1);
    expect(tx.businessEvent.create).toHaveBeenCalledTimes(1);
    expect(tx.businessEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: 'category_create',
        bizType: 'category',
        bizId: REQUEST_ID,
        payload: expect.objectContaining({ categoryId: '10' }),
      }),
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'Serializable' },
    );
  });

  it('fails closed when a create request id is reused with changed category data', async () => {
    const { service, tx } = createHarness();

    await service.create({ name: '一级分类', clientRequestId: REQUEST_ID });

    await expect(service.create({
      name: '另一个分类',
      clientRequestId: REQUEST_ID,
    })).rejects.toThrow('分类创建请求ID已被其他操作使用');
    expect(tx.productCategory.create).toHaveBeenCalledTimes(1);
  });

  it('replays success for a category already soft-deleted', async () => {
    const { service, tx, currentCategory } = createHarness();
    currentCategory.deletedAt = new Date('2026-08-14T01:00:00.000Z');

    const result: any = await service.delete('10');

    expect(result.id).toBe('10');
    expect(tx.productCategory.count).not.toHaveBeenCalled();
    expect(tx.product.count).not.toHaveBeenCalled();
    expect(tx.productCategory.update).not.toHaveBeenCalled();
  });

  it('keeps unknown and malformed category ids fail-closed', async () => {
    const { service, prisma, tx } = createHarness();
    tx.$queryRaw.mockResolvedValueOnce([]);

    await expect(service.delete('999')).rejects.toThrow('分类不存在');
    await expect(service.delete('bad-id')).rejects.toThrow('分类ID无效');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.productCategory.update).not.toHaveBeenCalled();
  });
});
