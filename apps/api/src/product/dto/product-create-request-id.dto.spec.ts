import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateProductDto } from './create-product.dto';
import { UpdateProductDto } from './update-product.dto';

const REQUEST_ID = '1760000000000000001';

describe('product create-only request identity DTO contract', () => {
  it('accepts a valid create request id on product creation', async () => {
    const dto = plainToInstance(CreateProductDto, {
      name: '测试商品',
      categoryId: '1',
      skus: [{ skuCode: 'SKU-STABLE-1', price: 100, stock: 0 }],
      clientRequestId: REQUEST_ID,
    });

    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });

    expect(errors).toHaveLength(0);
  });

  it('rejects clientRequestId on product update under production whitelist semantics', async () => {
    const dto = plainToInstance(UpdateProductDto, {
      clientRequestId: REQUEST_ID,
    });

    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });

    expect(errors.map((error) => error.property)).toContain('clientRequestId');
  });
});
