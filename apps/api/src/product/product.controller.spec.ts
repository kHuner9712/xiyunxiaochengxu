import { describe, expect, it, jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { WeappProductController } from './product.controller';

function createController(product: Record<string, unknown>) {
  const productService = {
    findById: jest.fn<any>().mockResolvedValue(product),
  };
  return {
    controller: new WeappProductController(productService as any),
    productService,
  };
}

describe('WeappProductController', () => {
  it('公开详情只返回已上架商品', async () => {
    const product = { id: '9007199254740993', status: 1, name: '已上架商品' };
    const { controller, productService } = createController(product);

    await expect(controller.detail('9007199254740993')).resolves.toBe(product);
    expect(productService.findById).toHaveBeenCalledWith('9007199254740993');
  });

  it.each([0, 2, 3])('公开详情拒绝非上架状态 %s', async (status) => {
    const { controller } = createController({ id: '9', status, name: '不可公开商品' });

    await expect(controller.detail('9')).rejects.toThrow(NotFoundException);
    await expect(controller.detail('9')).rejects.toThrow('商品不存在或已下架');
  });
});
