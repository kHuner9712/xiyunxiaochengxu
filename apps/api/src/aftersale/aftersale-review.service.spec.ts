import { BadRequestException } from '@nestjs/common';
import { AftersaleStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AftersaleReviewService } from './aftersale-review.service';
import { RETURN_DESTINATION_ACTION } from './return-destination';

function createMockPrisma() {
  const prisma: any = {
    aftersaleOrder: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    aftersaleLog: {
      create: jest.fn(),
    },
  };
  prisma.$transaction = jest.fn(async (callback: any) => callback(prisma));
  return prisma;
}

function approvedCandidate(type = 2) {
  const orderItem = { id: 20n, subtotal: 10000, activityDiscount: 0 };
  return {
    id: 10n,
    status: AftersaleStatus.pending_review,
    type,
    orderItem,
    order: {
      id: 1n,
      payAmount: 10000,
      totalAmount: 10000,
      freightAmount: 0,
      discountAmount: 0,
      couponAmount: 0,
      pointsAmount: 0,
      activityDiscountAmount: 0,
      orderItems: [orderItem],
      orderRefunds: [],
      aftersaleOrders: [],
    },
  };
}

describe('AftersaleReviewService return destination', () => {
  let prisma: ReturnType<typeof createMockPrisma>;
  let detailService: { findAdminDetail: jest.Mock };
  let service: AftersaleReviewService;

  beforeEach(() => {
    prisma = createMockPrisma();
    prisma.aftersaleOrder.updateMany.mockResolvedValue({ count: 1 });
    prisma.aftersaleLog.create.mockResolvedValue({});
    detailService = { findAdminDetail: jest.fn().mockResolvedValue({ id: '10' }) };
    service = new AftersaleReviewService(prisma as any, detailService as any);
  });

  it('refuses to approve a return-refund without a complete return destination', async () => {
    prisma.aftersaleOrder.findFirst.mockResolvedValue(approvedCandidate(2));

    await expect(service.approve('10', '3', {
      refundAmount: 10000,
    })).rejects.toThrow(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('writes approval and versioned return destination in one transaction', async () => {
    prisma.aftersaleOrder.findFirst.mockResolvedValue(approvedCandidate(2));

    await service.approve('10', '3', {
      refundAmount: 10000,
      returnReceiverName: '售后仓',
      returnReceiverPhone: '021-12345678',
      returnAddress: '上海市浦东新区测试路88号',
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.aftersaleOrder.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 10n, status: AftersaleStatus.pending_review },
      data: expect.objectContaining({ status: AftersaleStatus.approved, refundAmount: 10000 }),
    }));
    const destinationLog = prisma.aftersaleLog.create.mock.calls
      .map((call: any[]) => call[0].data)
      .find((data: any) => data.action === RETURN_DESTINATION_ACTION);
    expect(destinationLog).toBeTruthy();
    expect(JSON.parse(destinationLog.content)).toEqual({
      version: 1,
      receiverName: '售后仓',
      receiverPhone: '021-12345678',
      address: '上海市浦东新区测试路88号',
    });
  });

  it('does not require return destination for refund-only review', async () => {
    prisma.aftersaleOrder.findFirst.mockResolvedValue(approvedCandidate(1));

    await expect(service.approve('10', '3', { refundAmount: 10000 })).resolves.toEqual({ id: '10' });
    const actions = prisma.aftersaleLog.create.mock.calls.map((call: any[]) => call[0].data.action);
    expect(actions).toContain('approve');
    expect(actions).not.toContain(RETURN_DESTINATION_ACTION);
  });
});
