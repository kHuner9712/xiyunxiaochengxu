import { jest } from '@jest/globals';
import { REFUND_STATUS, WECHAT_REFUND_STATUS } from '../common/constants';
import { ConfirmedMissingRefundRetryPaymentService } from './confirmed-missing-refund-retry-payment.service';
import { OrphanSafeMemberGrowthPaymentService } from './orphan-safe-member-growth-payment.service';

function createService(localStatus: string) {
  const prisma: any = {
    orderRefund: {
      findFirst: jest.fn(async () => ({ status: localStatus })),
    },
  };
  const config: any = { get: jest.fn((_key: string, fallback?: unknown) => fallback ?? '') };
  const businessEvent: any = {};
  const orderService: any = {};
  const shareService: any = {};
  const benefitPackageService: any = {};
  const merchantSettlementService: any = {};
  const groupBuyService: any = {};
  const flashSaleService: any = {};
  const redisService: any = {};

  const service = new ConfirmedMissingRefundRetryPaymentService(
    prisma,
    config,
    businessEvent,
    orderService,
    shareService,
    benefitPackageService,
    merchantSettlementService,
    groupBuyService,
    flashSaleService,
    redisService,
  );
  return { service, prisma };
}

describe('ConfirmedMissingRefundRetryPaymentService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('translates WeChat RESOURCE_NOT_EXISTS to CLOSED only for a local FAILED refund', async () => {
    const error = Object.assign(new Error('refund not found'), {
      response: { data: { code: 'RESOURCE_NOT_EXISTS' } },
    });
    jest
      .spyOn(OrphanSafeMemberGrowthPaymentService.prototype, 'queryRefund')
      .mockRejectedValue(error as never);
    const { service, prisma } = createService(REFUND_STATUS.FAILED);

    await expect(service.queryRefund('RF-404')).resolves.toEqual({
      status: WECHAT_REFUND_STATUS.CLOSED,
      syntheticTerminalReason: 'RESOURCE_NOT_EXISTS',
    });
    expect(prisma.orderRefund.findFirst).toHaveBeenCalledWith({
      where: { outRefundNo: 'RF-404' },
      select: { status: true },
    });
  });

  it('keeps RESOURCE_NOT_EXISTS as an error for a local PENDING refund', async () => {
    const error = Object.assign(new Error('refund not found'), {
      response: { data: { code: 'RESOURCE_NOT_EXISTS' } },
    });
    jest
      .spyOn(OrphanSafeMemberGrowthPaymentService.prototype, 'queryRefund')
      .mockRejectedValue(error as never);
    const { service } = createService(REFUND_STATUS.PENDING);

    await expect(service.queryRefund('RF-PENDING')).rejects.toBe(error);
  });

  it('does not reinterpret unrelated WeChat query failures', async () => {
    const error = Object.assign(new Error('system error'), {
      response: { data: { code: 'SYSTEM_ERROR' } },
    });
    jest
      .spyOn(OrphanSafeMemberGrowthPaymentService.prototype, 'queryRefund')
      .mockRejectedValue(error as never);
    const { service, prisma } = createService(REFUND_STATUS.FAILED);

    await expect(service.queryRefund('RF-SYSTEM')).rejects.toBe(error);
    expect(prisma.orderRefund.findFirst).not.toHaveBeenCalled();
  });
});
