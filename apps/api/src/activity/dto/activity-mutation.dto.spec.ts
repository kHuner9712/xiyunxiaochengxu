import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateActivityDto } from './create-activity.dto';
import { UpdateActivityDto } from './update-activity.dto';

const REQUEST_ID = '1760000000000000001';

function validCreate(overrides: Record<string, unknown> = {}) {
  return plainToInstance(CreateActivityDto, {
    name: '测试活动',
    type: '1',
    startTime: '2026-08-14T00:00:00.000Z',
    endTime: '2026-08-20T00:00:00.000Z',
    products: [{
      productId: '20',
      skuId: '30',
      activityPrice: 900,
      activityStock: 10,
      limitPerUser: 1,
    }],
    clientRequestId: REQUEST_ID,
    ...overrides,
  });
}

describe('activity mutation DTO production contracts', () => {
  it('accepts a create request id and signed INT boundary product values', async () => {
    const dto = validCreate({
      products: [{
        productId: '20',
        skuId: '30',
        activityPrice: 2147483647,
        activityStock: 2147483647,
        limitPerUser: 2147483647,
      }],
    });

    await expect(validate(dto, { whitelist: true, forbidNonWhitelisted: true })).resolves.toHaveLength(0);
  });

  it('rejects product numbers above MySQL signed INT before persistence', async () => {
    const dto = validCreate({
      products: [{
        productId: '20',
        skuId: '30',
        activityPrice: 2147483648,
        activityStock: 2147483648,
        limitPerUser: 2147483648,
      }],
    });

    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    const productErrors = errors.find((error) => error.property === 'products');

    expect(productErrors?.children?.[0]?.children?.map((child) => child.property)).toEqual(
      expect.arrayContaining(['activityPrice', 'activityStock', 'limitPerUser']),
    );
  });

  it('keeps clientRequestId create-only under production whitelist semantics', async () => {
    const dto = plainToInstance(UpdateActivityDto, { clientRequestId: REQUEST_ID });

    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });

    expect(errors.map((error) => error.property)).toContain('clientRequestId');
  });
});
