import { BadRequestException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PAYMENT_STATUS, REFUND_STATUS } from '../common/constants';
import { RecoverableProductionPaymentService } from './recoverable-production-payment.service';

describe('RecoverableProductionPaymentService', () => {
  function createService(latestRefund: any) {
    const prisma: any = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      orderRefund: {
        findFirst: jest.fn().mockResolvedValue(latestRefund),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
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
        findFirst: jest.fn(),
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
      reconcileOrderBenefits: jest.fn(),
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

  it('never releases paid-order side effects while a group order is still waiting to form', async () => {
    const { service, prisma, benefitService, shareService } = createService(null);
    prisma.paymentCompensationTask.findMany.mockResolvedValue([{
      id: 20n,
      orderNo: 'O42',
      reason: 'paid_order_side_effects',
      status: 'pending',
      updatedAt: new Date(),
    }]);
    prisma.order.findFirst.mockResolvedValue({
      id: 42n,
      userId: 8n,
      orderNo: 'O42',
      payAmount: 1000,
      status: OrderStatus.paid,
    });

    const result = await service.reconcilePaidOrderSideEffects();

    expect(result.skipped).toBe(1);
    expect(shareService.processFirstPaidReward).not.toHaveBeenCalled();
    expect(benefitService.reconcileOrderBenefits).not.toHaveBeenCalled();
  });

  it('reconciles attribution and benefits for an eligible paid order before resolving the task', async () => {
    const { service, prisma, benefitService, shareService } = createService(null);
    prisma.paymentCompensationTask.findMany.mockResolvedValue([{
      id: 21n,
      orderNo: 'O43',
      reason: 'paid_order_side_effects',
      status: 'pending',
      updatedAt: new Date(),
    }]);
    prisma.order.findFirst.mockResolvedValue({
      id: 43n,
      userId: 9n,
      orderNo: 'O43',
      payAmount: 1200,
      status: OrderStatus.pending_delivery,
    });
    prisma.orderRefund.findMany.mockResolvedValue([{ id: 99n }]);

    const result = await service.reconcilePaidOrderSideEffects();

    expect(shareService.processFirstPaidReward).toHaveBeenCalledWith('9', '43', 1200);
    expect(shareService.reverseFirstPaidAttributionAfterRefund).toHaveBeenCalledWith(43n, 99n);
    expect(benefitService.reconcileOrderBenefits).toHaveBeenCalledWith(43n, 9n);
    expect(prisma.paymentCompensationTask.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 21n, status: 'pending' },
        data: expect.objectContaining({ status: 'resolved' }),
      }),
    );
    expect(result.resolved).toBe(1);
  });

  it('does not allow an admin to bypass durable money or benefit side-effect tasks', async () => {
    const { service, prisma } = createService(null);
    for (const reason of ['refund_success_side_effects', 'paid_order_side_effects']) {
      prisma.paymentCompensationTask.findFirst.mockResolvedValue({
        id: 9n,
        reason,
        status: 'pending',
      });

      await expect(
        service.resolveCompensationTask('9', '1', 'manual bypass', 'ignored'),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.resolveCompensationTask('9', '1', 'manual bypass', 'resolved'),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
  });
});
