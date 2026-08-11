import { AsyncLocalStorage } from 'node:async_hooks';
import { jest } from '@jest/globals';
import { ProductionFlashSaleService } from './flash-sale/production-flash-sale.service';
import { IdempotentProductionFlashSaleService } from './flash-sale/idempotent-production-flash-sale.service';
import { BigintSafeProductionGroupBuyService } from './group-buy/bigint-safe-production-group-buy.service';
import { IdempotentBigintSafeProductionGroupBuyService } from './group-buy/idempotent-bigint-safe-production-group-buy.service';
import { AttributionSafeQuotaActivityMultiItemCheckoutService } from './activity/attribution-safe-quota-activity-multi-item-checkout.service';
import { IdempotentAttributionSafeQuotaActivityMultiItemCheckoutService } from './activity/idempotent-attribution-safe-quota-activity-multi-item-checkout.service';

const CLIENT_REQUEST_ID = '1786449600000-abcdefghijklmnopqrstuvwx';

function flashWinner() {
  return {
    order: {
      id: 201n,
      payAmount: 990,
      status: 'pending_payment',
      fulfillmentType: 'delivery',
    },
    business: {
      id: 301n,
      quantity: 1,
      flashPrice: 990,
      lockExpireAt: new Date('2026-08-11T14:00:00.000Z'),
    },
  };
}

function bareFlash(prisma: any) {
  const service = Object.create(IdempotentProductionFlashSaleService.prototype) as any;
  service.sourcePrisma = prisma;
  service.idempotencyStorage = new AsyncLocalStorage();
  return service as IdempotentProductionFlashSaleService;
}

function groupWinner() {
  return {
    order: {
      id: 601n,
      payAmount: 1990,
      status: 'pending_payment',
      fulfillmentType: 'delivery',
    },
    member: { groupId: 501n, role: 'member' },
    group: { id: 501n, groupNo: 'GB501' },
  };
}

function bareGroup(prisma: any) {
  const service = Object.create(IdempotentBigintSafeProductionGroupBuyService.prototype) as any;
  service.sourcePrisma = prisma;
  service.idempotencyStorage = new AsyncLocalStorage();
  return service as IdempotentBigintSafeProductionGroupBuyService;
}

function bareActivity(prisma: any) {
  const service = Object.create(
    IdempotentAttributionSafeQuotaActivityMultiItemCheckoutService.prototype,
  ) as any;
  service.sourcePrisma = prisma;
  service.idempotencyStorage = new AsyncLocalStorage();
  return service as IdempotentAttributionSafeQuotaActivityMultiItemCheckoutService;
}

describe('promotion checkout idempotent wrappers', () => {
  afterEach(() => jest.restoreAllMocks());

  it('returns an already committed flash-sale order before entering checkout again', async () => {
    const winner = flashWinner();
    const prisma = {
      order: { findFirst: jest.fn<any>().mockResolvedValue(winner.order) },
      flashSaleOrder: { findFirst: jest.fn<any>().mockResolvedValue(winner.business) },
    };
    const superSpy = jest
      .spyOn(ProductionFlashSaleService.prototype, 'weappBuy')
      .mockRejectedValue(new Error('must not run'));

    const result = await bareFlash(prisma).weappBuy('7', {
      clientRequestId: CLIENT_REQUEST_ID,
      activityId: '101',
      quantity: 1,
    });

    expect(result).toMatchObject({
      flashSaleOrderId: '301',
      orderId: '201',
      quantity: 1,
      orderStatus: 'pending_payment',
    });
    expect(superSpy).not.toHaveBeenCalled();
  });

  it('recovers the flash-sale winner after a concurrent unique-order-number race', async () => {
    const winner = flashWinner();
    const prisma = {
      order: {
        findFirst: jest.fn<any>()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(winner.order),
      },
      flashSaleOrder: { findFirst: jest.fn<any>().mockResolvedValue(winner.business) },
    };
    jest.spyOn(ProductionFlashSaleService.prototype, 'weappBuy')
      .mockRejectedValueOnce(new Error('Unique constraint failed on order_no'));

    const result = await bareFlash(prisma).weappBuy('7', {
      clientRequestId: CLIENT_REQUEST_ID,
      activityId: '101',
      quantity: 1,
    });

    expect(result.orderId).toBe('201');
    expect(prisma.order.findFirst).toHaveBeenCalledTimes(2);
  });

  it('recovers the committed group membership instead of consuming another participation slot', async () => {
    const winner = groupWinner();
    const prisma = {
      order: {
        findFirst: jest.fn<any>()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(winner.order),
      },
      groupBuyMember: { findFirst: jest.fn<any>().mockResolvedValue(winner.member) },
      groupBuyGroup: { findUnique: jest.fn<any>().mockResolvedValue(winner.group) },
    };
    jest.spyOn(BigintSafeProductionGroupBuyService.prototype, 'joinGroupBuy')
      .mockRejectedValueOnce(new Error('Unique constraint failed on order_no'));

    const result = await bareGroup(prisma).joinGroupBuy('7', {
      clientRequestId: CLIENT_REQUEST_ID,
      groupId: '501',
      quantity: 1,
    });

    expect(result).toMatchObject({
      groupId: '501',
      groupNo: 'GB501',
      orderId: '601',
      role: 'member',
      orderStatus: 'pending_payment',
    });
    expect(prisma.order.findFirst).toHaveBeenCalledTimes(2);
  });

  it('recovers the committed activity order after the losing transaction rolls back', async () => {
    const order = {
      id: 701n,
      orderNo: 'XY20260811200000abcdef123456',
      payAmount: 2990,
      status: 'pending_payment',
      fulfillmentType: 'delivery',
    };
    const prisma = {
      order: {
        findFirst: jest.fn<any>()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(order),
      },
    };
    jest.spyOn(AttributionSafeQuotaActivityMultiItemCheckoutService.prototype, 'createOrder')
      .mockRejectedValueOnce(new Error('Unique constraint failed on order_no'));

    const result = await bareActivity(prisma).createOrder(
      7n,
      801n,
      901n,
      1001n,
      {
        clientRequestId: CLIENT_REQUEST_ID,
        activityProductId: '901',
        skuId: '1001',
        quantity: 1,
      },
    );

    expect(result).toMatchObject({
      orderId: '701',
      payAmount: 2990,
      status: 'pending_payment',
      activityId: '801',
      activityProductId: '901',
    });
    expect(prisma.order.findFirst).toHaveBeenCalledTimes(2);
  });
});
