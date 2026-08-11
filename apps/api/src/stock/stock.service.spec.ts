import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';
import { StockService } from './stock.service';

describe('StockService inventory database bounds', () => {
  it('rejects an inbound adjustment whose resulting stock exceeds MySQL signed INT', async () => {
    const prisma = {
      productSku: {
        findFirst: jest.fn().mockResolvedValue({
          id: 1n,
          productId: 2n,
          stock: 2_100_000_000,
          product: { id: 2n, name: '测试商品' },
        }),
      },
      $transaction: jest.fn(),
    } as any;
    const service = new StockService(prisma);

    await expect(
      service.adjust({ skuId: '1', type: 'in', quantity: 100_000_000, reason: '大额入库' }, '3'),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
