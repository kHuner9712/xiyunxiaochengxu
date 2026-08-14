import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCategoryDto } from './create-category.dto';
import { UpdateCategoryDto } from './update-category.dto';

const REQUEST_ID = '1760000000000000001';

describe('category create-only request identity DTO contract', () => {
  it('accepts a valid create request id on category creation', async () => {
    const dto = plainToInstance(CreateCategoryDto, {
      name: '测试分类',
      parentId: '0',
      clientRequestId: REQUEST_ID,
    });

    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });

    expect(errors).toHaveLength(0);
  });

  it('rejects clientRequestId on category update under production whitelist semantics', async () => {
    const dto = plainToInstance(UpdateCategoryDto, {
      clientRequestId: REQUEST_ID,
    });

    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });

    expect(errors.map((error) => error.property)).toContain('clientRequestId');
  });
});
