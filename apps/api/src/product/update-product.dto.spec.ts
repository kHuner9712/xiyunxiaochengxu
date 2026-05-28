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
      brandId: 2,
      supplierId: 3,
      recommendAgeMin: 0,
      recommendAgeMax: 36,
      isPeriodPurchase: 1,
      sortOrder: 10,
      isRecommend: 1,
      skus: [{ price: 1000, stock: 10, specs: { color: 'red' } }],
    };

    const result = await pipe.transform(payload, {
      type: 'body',
      metatype: UpdateProductDto,
    });

    expect(result).toBeDefined();
  });

  it('推荐年龄最小值大于最大值时应拒绝', async () => {
    const payload = {
      recommendAgeMin: 12,
      recommendAgeMax: 6,
      skus: [{ price: 1000, stock: 10 }],
    };

    await expect(
      pipe.transform(payload, {
        type: 'body',
        metatype: UpdateProductDto,
      }),
    ).rejects.toThrow(BadRequestException);
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
