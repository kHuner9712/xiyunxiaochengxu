import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePickupStoreDto, UpdatePickupStoreDto } from './pickup-store.dto';

const REQUEST_ID = '1760000000000000001';

describe('pickup store admin DTO production contracts', () => {
  it('accepts a valid create request id and signed INT sort boundary', async () => {
    const dto = plainToInstance(CreatePickupStoreDto, {
      name: '测试自提点', province: '广东省', city: '深圳市', district: '南山区',
      address: '测试路1号', sortOrder: 2147483647, clientRequestId: REQUEST_ID,
    });
    expect(await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).toHaveLength(0);
  });

  it('rejects sort order above the MySQL signed INT boundary', async () => {
    const dto = plainToInstance(CreatePickupStoreDto, {
      name: '测试自提点', province: '广东省', city: '深圳市', district: '南山区',
      address: '测试路1号', sortOrder: 2147483648,
    });
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.map((error) => error.property)).toContain('sortOrder');
  });

  it('keeps clientRequestId create-only under production whitelist semantics', async () => {
    const dto = plainToInstance(UpdatePickupStoreDto, { clientRequestId: REQUEST_ID });
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.map((error) => error.property)).toContain('clientRequestId');
  });
});
