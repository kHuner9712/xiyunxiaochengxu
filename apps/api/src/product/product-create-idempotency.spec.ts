import { ProductService } from './product.service';
import { ProductionProductService } from './production-product.service';

const REQUEST_ID = '1760000000000000001';

function createHarness() {
  let createEvent: any = null;
  let productState: any = {
    id: 7n,
    deletedAt: null,
    status: 3,
  };
  const createdProduct = {
    id: 7n,
    skus: [
      {
        id: 70n,
        productId: 7n,
        skuCode: 'SKU-NEW-STABLECODE000001',
        price: 1200,
        stock: 5,
      },
    ],
  };
  const tx: any = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: 1n }]),
    businessEvent: {
      findFirst: jest.fn(async () => createEvent),
      create: jest.fn(async ({ data }: any) => {
        createEvent = { id: 91n, ...data };
        return createEvent;
      }),
    },
    product: {
      findFirst: jest.fn(async () => ({ id: productState.id, deletedAt: productState.deletedAt })),
      findUnique: jest.fn(async () => productState),
      create: jest.fn().mockResolvedValue(createdProduct),
      update: jest.fn(async ({ data }: any) => {
        if (data.deletedAt) productState = { ...productState, deletedAt: data.deletedAt };
        return { ...productState, skus: [], productImages: [], category: null, brand: null, supplier: null };
      }),
    },
    productStockLog: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const prisma: any = {
    $transaction: jest.fn(async (callback: any) => callback(tx)),
    product: { findFirst: jest.fn() },
  };
  const service = new ProductionProductService(prisma);
  const findAdminSpy = jest
    .spyOn(ProductService.prototype, 'findAdminById')
    .mockImplementation(async (id: string) => ({ id } as any));
  const serializeSpy = jest
    .spyOn(ProductService.prototype as any, 'serializeProduct')
    .mockImplementation((product: any) => ({ ...product, id: product.id.toString() }));
  return { service, prisma, tx, findAdminSpy, serializeSpy, getProductState: () => productState };
}

describe('ProductionProductService create/delete durability', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('replays one committed create request without duplicating product, SKU stock ledger, or request fact', async () => {
    const { service, prisma, tx } = createHarness();
    const input: any = {
      name: '测试商品',
      categoryId: '1',
      clientRequestId: REQUEST_ID,
      skus: [
        {
          skuCode: 'SKU-NEW-STABLECODE000001',
          specs: { 规格1: '默认' },
          price: 1200,
          stock: 5,
        },
      ],
    };

    const first: any = await service.create(input);
    const retry: any = await service.create(input);

    expect(first.id).toBe('7');
    expect(retry.id).toBe('7');
    expect(tx.product.create).toHaveBeenCalledTimes(1);
    expect(tx.productStockLog.createMany).toHaveBeenCalledTimes(1);
    expect(tx.businessEvent.create).toHaveBeenCalledTimes(1);
    expect(tx.businessEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: 'product_create',
        bizType: 'product',
        bizId: REQUEST_ID,
        payload: expect.objectContaining({ productId: '7' }),
      }),
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'Serializable' },
    );
  });

  it('fails closed when one create request id is reused with changed product data', async () => {
    const { service, tx } = createHarness();
    const base: any = {
      name: '测试商品',
      categoryId: '1',
      clientRequestId: REQUEST_ID,
      skus: [{ skuCode: 'SKU-NEW-STABLECODE000001', price: 1200, stock: 5 }],
    };

    await service.create(base);

    await expect(service.create({ ...base, name: '篡改后的商品' })).rejects.toThrow(
      '商品创建请求ID已被其他操作使用',
    );
    expect(tx.product.create).toHaveBeenCalledTimes(1);
    expect(tx.businessEvent.create).toHaveBeenCalledTimes(1);
  });

  it('retries a serializable write conflict with a bounded retry instead of duplicating product creation', async () => {
    const { service, prisma, tx } = createHarness();
    const execute = prisma.$transaction.getMockImplementation();
    prisma.$transaction
      .mockRejectedValueOnce(Object.assign(new Error('write conflict'), { code: 'P2034' }))
      .mockImplementation(execute!);

    const result: any = await service.create({
      name: '测试商品',
      categoryId: '1',
      skus: [{ skuCode: 'SKU-NEW-STABLECODE000001', price: 1200, stock: 0 }],
    } as any);

    expect(result.id).toBe('7');
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(tx.product.create).toHaveBeenCalledTimes(1);
  });

  it('soft-deletes once and replays a retry after the success response is lost', async () => {
    const { service, tx, getProductState } = createHarness();

    const first: any = await service.delete('7');
    const retry: any = await service.delete('7');

    expect(first.id).toBe('7');
    expect(retry.id).toBe('7');
    expect(getProductState().deletedAt).toBeInstanceOf(Date);
    expect(tx.product.update).toHaveBeenCalledTimes(1);
  });

  it('keeps an unknown product id fail-closed on delete', async () => {
    const { service, tx } = createHarness();
    tx.$queryRaw.mockResolvedValueOnce([]);

    await expect(service.delete('999')).rejects.toThrow('商品不存在');

    expect(tx.product.update).not.toHaveBeenCalled();
  });
});
