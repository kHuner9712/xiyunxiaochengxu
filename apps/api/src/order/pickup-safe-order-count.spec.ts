import { describe, expect, it, jest } from '@jest/globals';
import { OrderStatus } from '@prisma/client';
import { PickupSafeIdempotentAttributionSafeMemberBenefitOrderService } from './pickup-safe-order.service';

function createService(counts: Partial<Record<OrderStatus, number>>) {
  const prisma = {
    order: {
      count: jest.fn(async ({ where }: any) => counts[where.status as OrderStatus] ?? 0),
    },
    $transaction: jest.fn(async (input: any) => {
      if (typeof input === 'function') return input({});
      return input;
    }),
  } as any;

  const businessEvent = {
    emit: jest.fn(),
    emitInfo: jest.fn(),
    emitWarn: jest.fn(),
    emitError: jest.fn(),
    emitCritical: jest.fn(),
  } as any;
  const benefitPackageService = {} as any;
  const groupBuyService = {} as any;
  const flashSaleService = {} as any;
  const redisService = {
    setNX: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
  } as any;

  const service = new PickupSafeIdempotentAttributionSafeMemberBenefitOrderService(
    prisma,
    businessEvent,
    benefitPackageService,
    groupBuyService,
    flashSaleService,
    redisService,
  );

  return { service, prisma };
}

describe('PickupSafeOrderService user order counts', () => {
  it('includes paid orders so the miniprogram pending-group badge is accurate', async () => {
    const { service, prisma } = createService({
      [OrderStatus.pending_payment]: 2,
      [OrderStatus.paid]: 3,
      [OrderStatus.pending_delivery]: 4,
      [OrderStatus.pending_pickup]: 5,
      [OrderStatus.delivered]: 6,
      [OrderStatus.aftersale]: 7,
    });

    await expect(service.getOrderCountByUser('100')).resolves.toEqual({
      unpaid: 2,
      paid: 3,
      unshipped: 4,
      pendingPickup: 5,
      unreceived: 6,
      aftersale: 7,
    });

    expect(prisma.order.count).toHaveBeenCalledWith({
      where: { userId: BigInt(100), status: OrderStatus.paid },
    });
  });
});
