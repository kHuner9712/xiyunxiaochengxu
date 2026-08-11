import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ProductionActivityContentService } from './production-activity-content.service';

function createMockPrisma() {
  return {
    activityContent: {
      findMany: jest.fn() as any,
      count: jest.fn() as any,
      findFirst: jest.fn() as any,
      update: jest.fn() as any,
      create: jest.fn() as any,
    },
    product: {
      findFirst: jest.fn() as any,
    },
  };
}

describe('ProductionActivityContentService', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let service: ProductionActivityContentService;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new ProductionActivityContentService(prisma as any);
    jest.spyOn((service as any).logger, 'log').mockImplementation(() => {});
    jest.spyOn((service as any).logger, 'error').mockImplementation(() => {});
    prisma.activityContent.findMany.mockResolvedValue([]);
    prisma.activityContent.count.mockResolvedValue(0);
  });

  it('uses the exact same public status/time/keyword filter for list rows and total count', async () => {
    await service.findWeappList({
      keyword: '奶粉',
      type: 'article',
      page: 1,
      pageSize: 10,
      skip: 0,
      take: 10,
    } as any);

    const rowWhere = prisma.activityContent.findMany.mock.calls[0][0].where;
    const countWhere = prisma.activityContent.count.mock.calls[0][0].where;
    expect(countWhere).toEqual(rowWhere);
    expect(rowWhere).toEqual(expect.objectContaining({
      status: 1,
      deletedAt: null,
      type: 'article',
      AND: expect.arrayContaining([
        expect.objectContaining({ OR: expect.any(Array) }),
      ]),
    }));
    expect(JSON.stringify(rowWhere)).toContain('奶粉');
  });

  it('rejects a direct detail URL when the content is outside its public time window', async () => {
    prisma.activityContent.findFirst.mockResolvedValue(null);

    await expect(service.findWeappDetail('9')).rejects.toThrow(NotFoundException);

    expect(prisma.activityContent.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 9n,
        status: 1,
        deletedAt: null,
        AND: expect.any(Array),
      }),
    });
  });

  it('hides a linked product from the public view after that product is unavailable', async () => {
    const now = new Date();
    prisma.activityContent.findFirst.mockResolvedValue({
      id: 9n,
      title: '商品推荐',
      type: 'product',
      status: 1,
      deletedAt: null,
      linkedProductId: 12n,
      viewCount: 3,
      startsAt: null,
      endsAt: null,
      createdAt: now,
    });
    prisma.activityContent.update.mockResolvedValue({});
    prisma.product.findFirst.mockResolvedValue(null);

    const result = await service.findWeappDetail('9');

    expect(prisma.product.findFirst).toHaveBeenCalledWith({
      where: { id: 12n, deletedAt: null, status: 1 },
      select: { id: true },
    });
    expect(result.linkedProductId).toBeNull();
  });

  it('refuses to publish/save a product recommendation that points at an unavailable product', async () => {
    prisma.product.findFirst.mockResolvedValue(null);

    await expect(service.create({
      title: '坏关联',
      type: 'product',
      linkedProductId: '12',
      status: 1,
    } as any)).rejects.toThrow(BadRequestException);

    expect(prisma.activityContent.create).not.toHaveBeenCalled();
  });

  it('rejects an impossible start/end window before it reaches the database write', async () => {
    await expect(service.create({
      title: '错误窗口',
      type: 'article',
      content: '正文',
      startsAt: '2026-08-11T00:00:00.000Z',
      endsAt: '2026-08-10T00:00:00.000Z',
      status: 1,
    } as any)).rejects.toThrow('活动内容结束时间必须晚于开始时间');

    expect(prisma.activityContent.create).not.toHaveBeenCalled();
  });
});
