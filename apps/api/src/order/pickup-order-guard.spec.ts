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

describe('pickup order transaction guard', () => {
  it('locks the active store and writes the locked snapshot into pickup orders', async () => {
    const orderCreate = jest.fn(async (args: any) => args.data);
    const tx: any = {
      $queryRaw: jest.fn().mockResolvedValue([{
        id: 9n,
        name: '新门店名称',
        province: '上海市',
        city: '上海市',
        district: '浦东新区',
        address: '世纪大道1号',
        contactPhone: '021-12345678',
      }]),
      order: { create: orderCreate },
    };
    const prisma: any = {
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    };
    const storage = new AsyncLocalStorage<{ pickupStoreId: bigint }>();
    installPickupStoreTransactionGuard(prisma, storage);

    const result: any = await storage.run(
      { pickupStoreId: 9n },
      () => prisma.$transaction((guardedTx: any) => guardedTx.order.create({
        data: {
          fulfillmentType: 'pickup',
          pickupStoreId: 9n,
          pickupStoreName: '旧页面名称',
          pickupStoreAddress: '旧地址',
          pickupContactPhone: '旧电话',
        },
      })),
    );

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(orderCreate).toHaveBeenCalledTimes(1);
    expect(result).toEqual(expect.objectContaining({
      pickupStoreId: 9n,
      pickupStoreName: '新门店名称',
      pickupStoreAddress: '上海市上海市浦东新区世纪大道1号',
      pickupContactPhone: '021-12345678',
    }));
  });

  it('fails closed before order creation when the store was disabled before the transaction lock', async () => {
    const orderCreate = jest.fn();
    const tx: any = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      order: { create: orderCreate },
    };
    const prisma: any = {
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    };
    const storage = new AsyncLocalStorage<{ pickupStoreId: bigint }>();
    installPickupStoreTransactionGuard(prisma, storage);

    await expect(storage.run(
      { pickupStoreId: 9n },
      () => prisma.$transaction((guardedTx: any) => guardedTx.order.create({
        data: { fulfillmentType: 'pickup', pickupStoreId: 9n },
      })),
    )).rejects.toThrow('自提点不存在或已停用');

    expect(orderCreate).not.toHaveBeenCalled();
  });

  it('locks pickup stores before delegating promotion checkout', async () => {
    const parent = jest
      .spyOn(AttributionAwarePromotionCheckoutService.prototype, 'createOrder')
      .mockResolvedValue({
        orderId: 1n,
        orderItemId: 2n,
        orderNo: 'XYTEST',
        payAmount: 100,
        isZeroPay: false,
        status: 'pending_payment' as any,
        fulfillmentType: 'pickup',
      });
    const tx: any = {
      $queryRaw: jest.fn().mockResolvedValue([{
        id: 9n,
        name: '门店',
        province: '上海市',
        city: '上海市',
        district: '浦东新区',
        address: '世纪大道1号',
        contactPhone: '021-12345678',
      }]),
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

      expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
      expect(parent).toHaveBeenCalledTimes(1);
      expect(result.orderId).toBe(1n);
    } finally {
      parent.mockRestore();
    }
  });

  it('wires both normal and promotion checkout tokens to pickup-safe production providers', () => {
    const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, OrderModule) as any[];
    const orderBinding = providers.find((provider) => provider?.provide === OrderService);
    const promotionBinding = providers.find((provider) => provider?.provide === PromotionCheckoutService);

    expect(orderBinding?.useClass).toBe(PickupSafeIdempotentAttributionSafeMemberBenefitOrderService);
    expect(promotionBinding?.useClass).toBe(PickupSafeAttributionAwarePromotionCheckoutService);
  });
});
