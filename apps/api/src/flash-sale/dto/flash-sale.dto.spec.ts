import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { FlashSaleActivityDto, FlashSaleBuyDto } from './flash-sale.dto';

describe('flash sale DTO bigint identifiers', () => {
  it('preserves bigint identifiers beyond JavaScript safe integer precision as strings', async () => {
    const dto = plainToInstance(FlashSaleActivityDto, {
      name: '大ID秒杀',
      productId: '9007199254740993',
      skuId: '9007199254740995',
      flashPrice: 990,
      stockLimit: 10,
      startTime: '2026-08-07 10:00:00',
      endTime: '2026-08-07 11:00:00',
    });

    expect(dto.productId).toBe('9007199254740993');
    expect(dto.skuId).toBe('9007199254740995');
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('normalizes safe numeric identifiers to strings', async () => {
    const dto = plainToInstance(FlashSaleBuyDto, {
      activityId: 42,
      quantity: 1,
      addressId: '7',
    });

    expect(dto.activityId).toBe('42');
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects numeric identifiers that already exceeded safe integer precision', async () => {
    const unsafeNumericId = Number('9007199254740993');
    const dto = plainToInstance(FlashSaleBuyDto, {
      activityId: unsafeNumericId,
      quantity: 1,
    });

    const errors = await validate(dto);
    expect(errors.some(error => error.property === 'activityId')).toBe(true);
  });
});
