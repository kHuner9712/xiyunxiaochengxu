import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';
import { StockService } from './stock.service';

describe('StockService inventory database bounds', () => {
  it('rejects an inbound adjustment whose resulting stock exceeds MySQL signed INT', async () => {
    const findFirst = jest.fn(async () => ({
      id: 1n,
      productId: 2n,
      stock: 2_100_000_000,
      product: { id: 2n, name: '测试商品' },
    }));
    const transaction = jest.fn();
    const prisma = {
      productSku: { findFirst },
      $transaction: transaction,
    } as any;
    const service = new StockService(prisma);

    await expect(
      service.adjust({
        skuId: '1',
        type: 'in',
        expectedStock: 2_100_000_000,
        quantity: 100_000_000,
        reason: '大额入库',
      }, '3'),
    ).rejects.toThrow(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects a retry that still carries the pre-success stock version', async () => {
    let currentStock = 50;
    const productSku = {
      findFirst: jest.fn(async () => ({
        id: 1n,
        productId: 2n,
        stock: currentStock,
        product: { id: 2n, name: '测试商品' },
      })),
    };
    const tx = {
      productSku: {
        updateMany: jest.fn(async ({ where, data }: any) => {
          if (currentStock !== where.stock) return { count: 0 };
          currentStock = Number(data.stock);
          return { count: 1 };
        }),
        findUnique: jest.fn(async () => ({ id: 1n, productId: 2n, stock: currentStock })),
      },
      productStockLog: { create: jest.fn(async () => ({ id: 1n })) },
    };
    const transaction = jest.fn(async (callback: any) => callback(tx));
    const service = new StockService({ productSku, $transaction: transaction } as any);
    const dto = {
      skuId: '1',
      type: 'in' as const,
      expectedStock: 50,
      quantity: 5,
      reason: '补货',
    };

    await expect(service.adjust(dto, '3')).resolves.toMatchObject({
      beforeStock: 50,
      afterStock: 55,
    });
    expect(currentStock).toBe(55);

    await expect(service.adjust(dto, '3')).rejects.toThrow('库存已变更');
    expect(currentStock).toBe(55);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(tx.productStockLog.create).toHaveBeenCalledTimes(1);
  });
});
