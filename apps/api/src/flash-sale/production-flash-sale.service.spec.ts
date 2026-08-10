import { describe, expect, it, jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { ProductionFlashSaleService } from './production-flash-sale.service';

function createService(status: number) {
  const prisma = {
    flashSaleActivity: {
      findFirst: jest.fn<any>().mockResolvedValue({
        id: 9007199254740993n,
        status,
        deletedAt: null,
      }),
    },
  };
  return new ProductionFlashSaleService(
    prisma as any,
    {} as any,
    {} as any,
    {} as any,
  );
}

describe('ProductionFlashSaleService public detail', () => {
  it('已上架秒杀活动可公开读取且保持 bigint-safe ID 查询', async () => {
    const service = createService(1);

    const result = await service.weappFindActivityById('9007199254740993');

    expect(result.id).toBe(9007199254740993n);
    expect(result.status).toBe(1);
  });

  it('已下架秒杀活动不可通过公开直链读取', async () => {
    const service = createService(0);

    await expect(service.weappFindActivityById('9007199254740993')).rejects.toThrow(NotFoundException);
    await expect(service.weappFindActivityById('9007199254740993')).rejects.toThrow('秒杀活动不存在或已下架');
  });
});
