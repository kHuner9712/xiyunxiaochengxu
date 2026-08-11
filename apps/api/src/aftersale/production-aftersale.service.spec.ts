import { BadRequestException } from '@nestjs/common';
import { AftersaleStatus } from '@prisma/client';
import { ProductionAftersaleService } from './production-aftersale.service';

function paidReturnAftersale() {
  const orderItem = { id: 11n, subtotal: 3000 };
  const order = {
    totalAmount: 3000,
    payAmount: 3000,
    freightAmount: 0,
    discountAmount: 0,
    couponAmount: 0,
    pointsAmount: 0,
    activityDiscountAmount: 0,
    orderItems: [orderItem],
    orderRefunds: [],
    aftersaleOrders: [{ id: 9n, orderItemId: 11n }],
  };
  return { id: 9n, type: 2, orderItem, order };
}

describe('ProductionAftersaleService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects partial-amount approval for return-and-refund aftersales', async () => {
    const prisma: any = {
      aftersaleOrder: {
        findFirst: jest.fn().mockResolvedValue(paidReturnAftersale()),
      },
    };
    const service = new ProductionAftersaleService(prisma, {} as any);

    await expect(service.approve('9', '1', 1000)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).toBeUndefined();
  });

  it('atomically claims a full remaining return refund review', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const logCreate = jest.fn().mockResolvedValue({ id: 1n });
    const prisma: any = {
      aftersaleOrder: {
        findFirst: jest.fn().mockResolvedValue(paidReturnAftersale()),
      },
      $transaction: jest.fn(async (callback: any) => callback({
        aftersaleOrder: { updateMany },
        aftersaleLog: { create: logCreate },
      })),
    };
    const service = new ProductionAftersaleService(prisma, {} as any);
    jest.spyOn(service, 'findAdminDetail').mockResolvedValue({ id: '9' } as any);

    await service.approve('9', '1', 3000);

    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 9n, status: AftersaleStatus.pending_review },
      data: expect.objectContaining({
        status: AftersaleStatus.approved,
        refundAmount: 3000,
        adminId: 1n,
      }),
    }));
    expect(logCreate).toHaveBeenCalledTimes(1);
  });

  it('rejects a review request that loses the pending-review claim race', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    const logCreate = jest.fn();
    const prisma: any = {
      aftersaleOrder: {
        findFirst: jest.fn().mockResolvedValue(paidReturnAftersale()),
      },
      $transaction: jest.fn(async (callback: any) => callback({
        aftersaleOrder: { updateMany },
        aftersaleLog: { create: logCreate },
      })),
    };
    const service = new ProductionAftersaleService(prisma, {} as any);

    await expect(service.approve('9', '1', 3000)).rejects.toThrow('售后单状态已变化');
    expect(logCreate).not.toHaveBeenCalled();
  });
});
