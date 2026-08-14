import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCouponDto } from './create-coupon.dto';
import { UpdateCouponDto } from './update-coupon.dto';

const REQUEST_ID = '1760000000000000001';

function validCreate(overrides: Record<string, unknown> = {}) {
  return plainToInstance(CreateCouponDto, {
    name: '测试券',
    type: 1,
    value: 1000,
    startTime: '2026-08-14T00:00:00.000Z',
    endTime: '2026-08-20T00:00:00.000Z',
    clientRequestId: REQUEST_ID,
    ...overrides,
  });
}

describe('coupon admin DTO production contracts', () => {
  it('preserves bigint member level ids as strings and numeric zero compatibility', async () => {
    const large = validCreate({ memberLevelId: '9007199254740993' });
    const unrestricted = validCreate({ memberLevelId: 0 });
    expect(large.memberLevelId).toBe('9007199254740993');
    expect(unrestricted.memberLevelId).toBe(0);
    expect(await validate(large, { whitelist: true, forbidNonWhitelisted: true })).toHaveLength(0);
    expect(await validate(unrestricted, { whitelist: true, forbidNonWhitelisted: true })).toHaveLength(0);
  });

  it('rejects values above the database integer boundary', async () => {
    const dto = validCreate({ value: 2147483648, totalCount: 2147483648, validDays: 2147483648 });
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.map((error) => error.property)).toEqual(expect.arrayContaining(['value', 'totalCount', 'validDays']));
  });

  it('rejects create-only clientRequestId on update', async () => {
    const dto = plainToInstance(UpdateCouponDto, { clientRequestId: REQUEST_ID });
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.map((error) => error.property)).toContain('clientRequestId');
  });

  it('preserves bigint member level ids as strings on update', async () => {
    const dto = plainToInstance(UpdateCouponDto, { memberLevelId: '9223372036854775807' });
    expect(dto.memberLevelId).toBe('9223372036854775807');
    expect(await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).toHaveLength(0);
  });
});
