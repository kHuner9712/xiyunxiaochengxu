import { describe, expect, it, jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { WeappPickupStoreController } from './pickup-store.controller';

function createController(status: number) {
  const store = {
    id: '9007199254740993',
    name: '测试自提点',
    status,
  };
  const service = {
    findById: jest.fn<any>().mockResolvedValue(store),
  };
  return {
    controller: new WeappPickupStoreController(service as any),
    service,
    store,
  };
}

describe('WeappPickupStoreController', () => {
  it('已启用自提点可公开读取且 ID 保持字符串', async () => {
    const { controller, service, store } = createController(1);

    await expect(controller.detail('9007199254740993')).resolves.toBe(store);
    expect(service.findById).toHaveBeenCalledWith('9007199254740993');
  });

  it('已停用自提点不可通过公开直链读取', async () => {
    const { controller } = createController(0);

    await expect(controller.detail('9007199254740993')).rejects.toThrow(NotFoundException);
    await expect(controller.detail('9007199254740993')).rejects.toThrow('自提点不存在或已停用');
  });
});
