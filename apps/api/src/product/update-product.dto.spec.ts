import { describe, it, expect } from '@jest/globals';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { UpdateProductDto } from './dto/update-product.dto';

describe('UpdateProductDto 白名单校验', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  it('合法字段应通过校验', async () => {
    const payload = {
      name: '测试商品',
      categoryId: 1,
      skus: [{ price: 1000, stock: 10, specs: { color: 'red' } }],
    };

    const result = await pipe.transform(payload, {
      type: 'body',
      metatype: UpdateProductDto,
    });

    expect(result).toBeDefined();
  });

  it('包含未声明字段时应拒绝', async () => {
    const payload = {
      name: '测试商品',
      skus: [{ price: 1000 }],
      unknownField: 'not-allowed',
    };

    await expect(
      pipe.transform(payload, {
        type: 'body',
        metatype: UpdateProductDto,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});

