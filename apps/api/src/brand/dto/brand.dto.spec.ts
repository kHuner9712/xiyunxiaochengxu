import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateBrandDto } from './create-brand.dto';
import { UpdateBrandDto } from './update-brand.dto';

const REQUEST_ID = '1760000000000000001';

describe('brand DTO production contract', () => {
  it('accepts the create-only request id and enforces database-backed string limits', async () => {
    const valid = plainToInstance(CreateBrandDto, {
      name: '品牌A',
      logo: 'https://example.com/logo.png',
      sortOrder: 0,
      clientRequestId: REQUEST_ID,
    });
    expect(await validate(valid, { whitelist: true, forbidNonWhitelisted: true })).toHaveLength(0);

    const tooLong = plainToInstance(CreateBrandDto, {
      name: 'A'.repeat(51),
      logo: 'x'.repeat(501),
    });
    const errors = await validate(tooLong, { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.map((error) => error.property)).toEqual(expect.arrayContaining(['name', 'logo']));
  });

  it('rejects clientRequestId on update under production whitelist semantics', async () => {
    const dto = plainToInstance(UpdateBrandDto, { clientRequestId: REQUEST_ID });
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });

    expect(errors.map((error) => error.property)).toContain('clientRequestId');
  });
});
