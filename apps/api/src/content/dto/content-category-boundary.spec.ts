import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateContentCategoryDto, UpdateContentCategoryDto } from './content-category.dto';

async function validateCreate(input: Record<string, unknown>) {
  return validate(plainToInstance(CreateContentCategoryDto, input), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
}

describe('content category database boundary DTO contract', () => {
  it('accepts values at the MySQL column boundaries', async () => {
    const errors = await validateCreate({
      name: '分'.repeat(50),
      icon: 'x'.repeat(500),
      sortOrder: 2147483647,
    });

    expect(errors).toHaveLength(0);
  });

  it('rejects names longer than VARCHAR(50) before persistence', async () => {
    const errors = await validateCreate({ name: '分'.repeat(51) });

    expect(errors.map((error) => error.property)).toContain('name');
  });

  it('rejects sort values above MySQL signed INT before persistence', async () => {
    const errors = await validateCreate({
      name: '测试分类',
      sortOrder: 2147483648,
    });

    expect(errors.map((error) => error.property)).toContain('sortOrder');
  });

  it('inherits the same boundaries on update', async () => {
    const dto = plainToInstance(UpdateContentCategoryDto, {
      name: '分'.repeat(51),
      sortOrder: 2147483648,
    });
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['name', 'sortOrder']),
    );
  });
});
