import { AsyncLocalStorage } from 'node:async_hooks';
import 'reflect-metadata';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { OrderModule } from './order.module';
import { OrderService } from './order.service';
import { PromotionCheckoutService } from './promotion-checkout.service';
import { AttributionAwarePromotionCheckoutService } from './attribution-aware-promotion-checkout.service';
import {
  installPickupStoreTransactionGuard,
  PickupSafeIdempotentAttributionSafeMemberBenefitOrderService,
} from './pickup-safe-order.service';
import { PickupSafeAttributionAwarePromotionCheckoutService } from './pickup-safe-promotion-checkout.service';

type OrderCreateContext = { userId: bigint; pickupStoreId?: bigint };

const lockedStore = {
  id: 9n,
  name: '新门店名称',
  province: '上海市',
  city: '上海市',
  district: '浦东新区',
  address: '世纪大道1号',
  contactPhone: '021-12345678',
};

describe('checkout transaction guards', () => {
  it('locks the active user first, then the active store, and writes the locked pickup snapshot', async () => {
    const orderCreate = jest.fn(async (args: any) => args.data);
    const tx: any = {
      $queryRaw: jest.fn()
        .mockResolvedValueOnce([{ id: 1n }])
        .mockResolvedValueOnce([lockedStore]),
      order: { create: orderCreate },
    };
    const prisma: any = {
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    };
    const storage = new AsyncLocalStorage<OrderCreateContext>();
    installPickupStoreTransactionGuard(prisma, storage);

    const result: any = await storage.run(
      { userId: 1n, pickupStoreId: 9n },
      () => prisma.$transaction((guardedTx: any) => guardedTx.order.create({
        data: {
          userId: 1n,
          fulfillmentType: 'pickup',
          pickupStoreId: 9n,
          pickupStoreName: '旧页面名称',
          pickupStoreAddress: '旧地址',
          pickupContactPhone: '旧电话',
        },
      })),
    );

    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(orderCreate).toHaveBeenCalledTimes(1);
    expect(result).toEqual(expect.objectContaining({
      pickupStoreId: 9n,
      pickupStoreName: '新门店名称',
      pickupStoreAddress: '上海市上海市浦东新区世纪大道1号',
      pickupContactPhone: '021-12345678',
    }));
  });

  it('fails closed before any normal order write when account cancellation already committed', async () => {
    const orderCreate = jest.fn();
    const tx: any = {
      $queryRaw: jest.fn().mockResolvedValueOnce([]),
      order: { create: orderCreate },
    };
    const prisma: any = {
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    };
    const storage = new AsyncLocalStorage<OrderCreateContext>();
    installPickupStoreTransactionGuard(prisma, storage);

    await expect(storage.run(
      { userId: 1n },
      () => prisma.$transaction((guardedTx: any) => guardedTx.order.create({
        data: { userId: 1n, fulfillmentType: 'delivery' },
      })),
    )).rejects.toThrow('账号已停用或注销');

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(orderCreate).not.toHaveBeenCalled();
  });

  it('fails closed before order creation when the pickup store was disabled after the user lock', async () => {
    const orderCreate = jest.fn();
    const tx: any = {
      $queryRaw: jest.fn()
        .mockResolvedValueOnce([{ id: 1n }])
        .mockResolvedValueOnce([]),
      order: { create: orderCreate },
    };
    const prisma: any = {
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    };
    const storage = new AsyncLocalStorage<OrderCreateContext>();
    installPickupStoreTransactionGuard(prisma, storage);

    await expect(storage.run(
      { userId: 1n, pickupStoreId: 9n },
      () => prisma.$transaction((guardedTx: any) => guardedTx.order.create({
        data: { userId: 1n, fulfillmentType: 'pickup', pickupStoreId: 9n },
      })),
    )).rejects.toThrow('自提点不存在或已停用');

    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(orderCreate).not.toHaveBeenCalled();
  });

  it('locks the active user and pickup store before promotion checkout reads the store snapshot', async () => {
    const parent = jest
      .spyOn(AttributionAwarePromotionCheckoutService.prototype, 'createOrder')
      .mockImplementation(async (guardedTx: any) => {
        const store = await guardedTx.pickupStore.findFirst({
          where: { id: 9n, status: 1, deletedAt: null },
        });
        return {
          orderId: 1n,
          orderItemId: 2n,
          orderNo: store.name,
          payAmount: 100,
          isZeroPay: false,
          status: 'pending_payment' as any,
          fulfillmentType: 'pickup',
        };
      });
    const fallbackFindFirst = jest.fn().mockResolvedValue({ name: '旧一致性快照门店' });
    const tx: any = {
      $queryRaw: jest.fn()
        .mockResolvedValueOnce([{ id: 1n }])
        .mockResolvedValueOnce([lockedStore]),
      pickupStore: { findFirst: fallbackFindFirst },
    };
    const service = new PickupSafeAttributionAwarePromotionCheckoutService();

    try {
      const result = await service.createOrder(tx, {
        userId: 1n,
        skuId: 2n,
        quantity: 1,
        unitPrice: 100,
        activityId: 3n,
        activityType: 'flash_sale',
        fulfillmentType: 'pickup',
        pickupStoreId: '9',
      });

      expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
      expect(parent).toHaveBeenCalledTimes(1);
      expect(fallbackFindFirst).not.toHaveBeenCalled();
      expect(result.orderNo).toBe('锁定后的当前门店');
    } finally {
      parent.mockRestore();
    }
  });

  it('does not enter promotion order creation when cancellation already tombstoned the user', async () => {
    const parent = jest
      .spyOn(AttributionAwarePromotionCheckoutService.prototype, 'createOrder')
      .mockResolvedValue({} as any);
    const tx: any = {
      $queryRaw: jest.fn().mockResolvedValueOnce([]),
    };
    const service = new PickupSafeAttributionAwarePromotionCheckoutService();

    try {
      await expect(service.createOrder(tx, {
        userId: 1n,
        skuId: 2n,
        quantity: 1,
        unitPrice: 100,
        activityId: 3n,
        activityType: 'flash_sale',
        fulfillmentType: 'delivery',
      })).rejects.toThrow('账号已停用或注销');
      expect(parent).not.toHaveBeenCalled();
    } finally {
      parent.mockRestore();
    }
  });

  it('wires both normal and promotion checkout tokens to guarded production providers', () => {
    const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, OrderModule) as any[];
    const orderBinding = providers.find((provider) => provider?.provide === OrderService);
    const promotionBinding = providers.find((provider) => provider?.provide === PromotionCheckoutService);

    expect(orderBinding?.useClass).toBe(PickupSafeIdempotentAttributionSafeMemberBenefitOrderService);
    expect(promotionBinding?.useClass).toBe(PickupSafeAttributionAwarePromotionCheckoutService);
  });
});
