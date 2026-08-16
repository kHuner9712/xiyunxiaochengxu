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

  it.each(['abc', '0', '-1', '9223372036854775808'])(
    '秒杀公开详情拒绝非法 ID %s，而不是让 BigInt 转换异常逃逸为 500',
    async (id) => {
      const service = createService(1);
      await expect(service.weappFindActivityById(id)).rejects.toThrow(/活动ID(无效|超出范围)/);
    },
  );

  it('我的秒杀仅返回页面所需字段，不暴露用户和订单项内部 ID', async () => {
    const now = new Date();
    const prisma = {
      flashSaleOrder: {
        findMany: jest.fn<any>().mockResolvedValue([{
          id: 9007199254740993n,
          activityId: 8000000000000001n,
          userId: 7000000000000001n,
          orderId: 6000000000000001n,
          orderItemId: 5000000000000001n,
          quantity: 1,
          flashPrice: 9900,
          status: 'pending_payment',
          lockExpireAt: new Date(now.getTime() + 60_000),
          paidAt: null,
          cancelledAt: null,
          expiredAt: null,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        }]),
        count: jest.fn<any>().mockResolvedValue(1),
      },
    };
    const service = new ProductionFlashSaleService(
      prisma as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const result: any = await service.weappFindMyOrders('123', { page: 1, pageSize: 20 });

    expect(result.list[0]).toMatchObject({
      id: '9007199254740993',
      activityId: '8000000000000001',
      orderId: '6000000000000001',
      quantity: 1,
      flashPrice: 9900,
      status: 'pending_payment',
    });
    expect(result.list[0]).not.toHaveProperty('userId');
    expect(result.list[0]).not.toHaveProperty('orderItemId');
    expect(result.list[0]).not.toHaveProperty('deletedAt');
    expect(result.list[0]).not.toHaveProperty('updatedAt');
  });
});