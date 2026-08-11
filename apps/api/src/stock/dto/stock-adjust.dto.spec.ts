import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { describe, expect, it } from '@jest/globals';
import { StockAdjustDto } from './stock-adjust.dto';

describe('StockAdjustDto database limits', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  it('accepts a normal stock adjustment with the rendered stock version', async () => {
    const result = await pipe.transform(
      { productId: '1', skuId: '2', type: 'in', expectedStock: 50, quantity: 100, reason: '正常入库' },
      { type: 'body', metatype: StockAdjustDto },
    );
    expect(result.quantity).toBe(100);
    expect(result.expectedStock).toBe(50);
  });

  it('rejects a stock adjustment that omits the optimistic stock version', async () => {
    await expect(
      pipe.transform(
        { skuId: '2', type: 'in', quantity: 1, reason: '缺少版本' },
        { type: 'body', metatype: StockAdjustDto },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects reasons longer than the stock log VARCHAR(200) column', async () => {
    await expect(
      pipe.transform(
        { skuId: '2', type: 'in', expectedStock: 0, quantity: 1, reason: 'R'.repeat(201) },
        { type: 'body', metatype: StockAdjustDto },
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
