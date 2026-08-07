import { BadRequestException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PAYMENT_STATUS, REFUND_STATUS } from '../common/constants';
import { RecoverableProductionPaymentService } from './recoverable-production-payment.service';

describe('RecoverableProductionPaymentService', () => {
  function createService(latestRefund: any) {
    const prisma: any = {
      orderRefund: {
        findFirst: jest.fn().mockResolvedValue(latestRefund),
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      groupBuyMember: {
        findFirst: jest.fn().mockResolvedValue({ status: 'paid', groupId: 7n }),
      },
      groupBuyGroup: {
        findFirst: jest.fn().mockResolvedValue({ status: 'failed' }),
      },
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 42n,
          orderNo: 'O42',
          status: OrderStatus.aftersale,
          payAmount: 1000,
          payment: { status: PAYMENT_STATUS.SUCCESS },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      paymentCompensationTask: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const config: any = {
      get: jest.fn((key: string, fallback?: unknown) => {
        if (key === 'NODE_ENV') return 'test';
        return fallback;
      }),
    };
    const businessEvent: any = {
      emitCritical: jest.fn(),
      emitWarn: jest.fn(),
      emitInfo: jest.fn(),
      emitError: jest.fn(),
    };
    const orderService: any = { assignUniquePickupCode: jest.fn() };
    const shareService: any = {
      processFirstPaidReward: jest.fn(),
      reverseFirstPaidAttributionAfterRefund: jest.fn(),
    };
    const benefitService: any = {
      assertRefundable: jest.fn(),
      freezeForRefund: jest.fn(),
      restoreAfterRefundClosed: jest.fn().mockResolvedValue({ affected: 0 }),
      revokeAfterRefundSuccess: jest.fn(),
      grantBenefitsForOrder: jest.fn(),
    };
    const merchantService: any = {
      generateSalesCommission: jest.fn(),
      reverseSalesCommissionAfterRefund: jest.fn(),
    };
    const groupService: any = {
      handlePaymentSuccess: jest.fn(),
      handleRefundSuccess: jest.fn(),
    };
    const flashService: any = { handlePaymentSuccess: jest.fn() };

    const service = new RecoverableProductionPaymentService(
      prisma,
      config,
      businessEvent,
      orderService,
      shareService,
      benefitService,
      merchantService,
      groupService,
      flashService,
    );

    return { service, prisma, benefitService, shareService };
  }

  it('creates a new refund only after the previous attempt is definitively closed', async () => {
    const previous = {
      id: 1n,
      orderId: 42n,
      status: REFUND_STATUS.CLOSED,
      refundNo: 'R1',
      outRefundNo: 'OR1',
    };
    const { service, benefitService } = createService(previous);
    const createRefund = jest.spyOn(service, 'createRefund').mockResolvedValue({
      refundId: '2',
      refundNo: 'R2',
      outRefundNo: 'OR2',
    } as any);

    const result = await service.createGroupBuyFailureRefund(42n);

    expect(benefitService.restoreAfterRefundClosed).toHaveBeenCalledWith(42n, null);
    expect(createRefund).toHaveBeenCalledWith({
      orderId: '42',
      refundAmount: 1000,
      reason: expect.stringContaining('失败终态重试'),
    });
    expect(result.status).toBe(REFUND_STATUS.PENDING);
    expect(result.outRefundNo).toBe('OR2');
  });

  it('does not send a second refund when a failed attempt cannot be resolved at WeChat', async () => {
    const previous = {
      id: 1n,
      orderId: 42n,
      status: REFUND_STATUS.FAILED,
      refundNo: 'R1',
      outRefundNo: 'OR1',
    };
    const { service } = createService(previous);
    jest.spyOn(service, 'queryRefund').mockRejectedValue(new Error('network unavailable'));
    const createRefund = jest.spyOn(service, 'createRefund');

    const result = await service.createGroupBuyFailureRefund(42n);

    expect(result.status).toBe(REFUND_STATUS.FAILED);
    expect(createRefund).not.toHaveBeenCalled();
  });

  it('moves an uncertain failed refund back to pending when WeChat reports PROCESSING', async () => {
    const previous = {
      id: 1n,
      orderId: 42n,
      status: REFUND_STATUS.FAILED,
      refundNo: 'R1',
      outRefundNo: 'OR1',
      refundId: null,
    };
    const { service, prisma } = createService(previous);
    jest.spyOn(service, 'queryRefund').mockResolvedValue({
      status: 'PROCESSING',
      refund_id: 'WX-R1',
    });
    const createRefund = jest.spyOn(service, 'createRefund');

    const result = await service.createGroupBuyFailureRefund(42n);

    expect(prisma.orderRefund.updateMany).toHaveBeenCalledWith({
      where: { id: 1n, status: REFUND_STATUS.FAILED },
      data: expect.objectContaining({
        status: REFUND_STATUS.PENDING,
        refundId: 'WX-R1',
      }),
    });
    expect(result.status).toBe(REFUND_STATUS.PENDING);
    expect(createRefund).not.toHaveBeenCalled();
  });

  it('keeps abnormal refunds frozen and never auto-retries them', async () => {
    const previous = {
      id: 1n,
      orderId: 42n,
      status: REFUND_STATUS.ABNORMAL,
      refundNo: 'R1',
      outRefundNo: 'OR1',
    };
    const { service, benefitService } = createService(previous);
    const createRefund = jest.spyOn(service, 'createRefund');

    const result = await service.createGroupBuyFailureRefund(42n);

    expect(result.status).toBe(REFUND_STATUS.ABNORMAL);
    expect(createRefund).not.toHaveBeenCalled();
    expect(benefitService.restoreAfterRefundClosed).not.toHaveBeenCalled();
  });

  it('does not allow an admin to ignore or manually resolve refund-success side-effect tasks', async () => {
    const { service, prisma } = createService(null);
    prisma.paymentCompensationTask.findFirst.mockResolvedValue({
      id: 9n,
      reason: 'refund_success_side_effects',
      status: 'pending',
    });

    await expect(
      service.resolveCompensationTask('9', '1', 'manual bypass', 'ignored'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.resolveCompensationTask('9', '1', 'manual bypass', 'resolved'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
