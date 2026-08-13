import { ProductionProductService } from './production-product.service';

describe('ProductionProductService supplier publish invariant', () => {
  it('rejects publishing a product whose supplier is inactive or deleted', async () => {
    const tx: any = {
      $queryRaw: jest.fn(),
      product: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    tx.$queryRaw
      .mockResolvedValueOnce([{ id: 7n, supplierId: 9n }])
      .mockResolvedValueOnce([]);
    tx.product.findUnique.mockResolvedValue({
      id: 7n,
      supplierId: 9n,
      deletedAt: null,
      minPrice: 100,
      attributes: { compliance: { isRegulated: false } },
      category: null,
    });

    const prisma: any = {
      $transaction: jest.fn(async (callback: any) => callback(tx)),
      product: {
        findFirst: jest.fn(),
      },
    };
    const service = new ProductionProductService(prisma);

    await expect(service.updateStatus('7', 1)).rejects.toThrow(
      '供应商不存在或已停用，请选择合作中的供应商',
    );

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(tx.product.update).not.toHaveBeenCalled();
  });
});
