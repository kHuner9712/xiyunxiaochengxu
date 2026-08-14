import { CheckoutReadyProductionActivityService } from './checkout-ready-production-activity.service';

function createBundleHarness() {
  const existingProducts = [
    { id: 71n, activityId: 10n, productId: 20n, skuId: 30n, activityPrice: 1000, activityStock: 10, limitPerUser: 0 },
    { id: 72n, activityId: 10n, productId: 21n, skuId: 40n, activityPrice: 1200, activityStock: 10, limitPerUser: 0 },
  ];
  const activity = {
    id: 10n,
    type: '4',
    status: 1,
    rules: {
      bundlePrice: 1800,
      bundleItems: [
        { skuId: '30', quantity: 1 },
        { skuId: '40', quantity: 1 },
      ],
    },
    endTime: new Date('2026-08-20T00:00:00.000Z'),
    activityProducts: existingProducts,
  };
  const skuRows: Record<string, any> = {
    '30': { id: 30n, productId: 20n, status: 1, price: 1000, stock: 20, product: { id: 20n, status: 1, fulfillmentType: 'delivery' } },
    '40': { id: 40n, productId: 21n, status: 1, price: 1200, stock: 20, product: { id: 21n, status: 1, fulfillmentType: 'delivery' } },
    '50': { id: 50n, productId: 22n, status: 1, price: 900, stock: 20, product: { id: 22n, status: 1, fulfillmentType: 'delivery' } },
  };
  const tx: any = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: 10n }]),
    activity: {
      findUnique: jest.fn().mockResolvedValue(activity),
    },
    activityProduct: {
      findUnique: jest.fn().mockResolvedValue(existingProducts[0]),
      create: jest.fn(),
      delete: jest.fn(),
    },
    product: {
      findFirst: jest.fn(async ({ where }: any) => ({ id: where.id, status: 1, minPrice: 900 })),
    },
    productSku: {
      findFirst: jest.fn(async ({ where }: any) => skuRows[String(where.id)] || null),
      findMany: jest.fn(async ({ where }: any) => where.id.in.map((id: bigint) => skuRows[id.toString()]).filter(Boolean)),
    },
    businessEvent: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
    },
  };
  const prisma: any = {
    ...tx,
    $transaction: jest.fn(async (callback: any) => callback(tx)),
  };
  return { service: new CheckoutReadyProductionActivityService(prisma), prisma, tx, activity };
}

describe('CheckoutReadyProductionActivityService whole-definition product mutations', () => {
  it('rejects adding a SKU when the bundle rules would no longer cover every activity SKU', async () => {
    const { service, tx } = createBundleHarness();

    await expect(service.addProduct('10', {
      productId: '22',
      skuId: '50',
      activityPrice: 900,
      activityStock: 10,
      limitPerUser: 0,
    })).rejects.toThrow('组合套餐规则必须覆盖当前活动中的全部SKU');

    expect(tx.activityProduct.create).not.toHaveBeenCalled();
  });

  it('rejects removing a bundle SKU when existing rules would reference a removed SKU', async () => {
    const { service, tx } = createBundleHarness();

    await expect(service.removeProduct('71')).rejects.toThrow('组合套餐SKU必须来自当前活动商品');

    expect(tx.activityProduct.delete).not.toHaveBeenCalled();
    expect(tx.businessEvent.create).not.toHaveBeenCalled();
  });
});
