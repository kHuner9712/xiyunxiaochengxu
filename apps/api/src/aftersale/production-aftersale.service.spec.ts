import { BadRequestException } from '@nestjs/common';
import { AftersaleService } from './aftersale.service';
import { ProductionAftersaleService } from './production-aftersale.service';

describe('ProductionAftersaleService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects partial-amount approval for return-and-refund aftersales', async () => {
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
    const prisma: any = {
      aftersaleOrder: {
        findFirst: jest.fn().mockResolvedValue({
          id: 9n,
          type: 2,
          orderItem,
          order,
        }),
      },
    };
    const baseApprove = jest
      .spyOn(AftersaleService.prototype, 'approve')
      .mockResolvedValue({ id: '9' } as any);
    const service = new ProductionAftersaleService(prisma, {} as any);

    await expect(service.approve('9', '1', 1000)).rejects.toBeInstanceOf(BadRequestException);
    expect(baseApprove).not.toHaveBeenCalled();
  });

  it('lets a full remaining return refund continue to the base review flow', async () => {
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
    const prisma: any = {
      aftersaleOrder: {
        findFirst: jest.fn().mockResolvedValue({
          id: 9n,
          type: 2,
          orderItem,
          order,
        }),
      },
    };
    const baseApprove = jest
      .spyOn(AftersaleService.prototype, 'approve')
      .mockResolvedValue({ id: '9' } as any);
    const service = new ProductionAftersaleService(prisma, {} as any);

    await service.approve('9', '1', 3000);
    expect(baseApprove).toHaveBeenCalledWith('9', '1', 3000);
  });
});
