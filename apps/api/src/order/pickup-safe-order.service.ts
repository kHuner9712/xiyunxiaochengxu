import { AsyncLocalStorage } from 'node:async_hooks';
import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { BusinessEventService } from '../common/business-event.service';
import { PAYMENT_STATUS } from '../common/constants/payment';
import { RedisService } from '../common/redis/redis.service';
import { BenefitPackageService } from '../benefit-package/benefit-package.service';
import { FlashSaleService } from '../flash-sale/flash-sale.service';
import { GroupBuyService } from '../group-buy/group-buy.service';
import { SystemConfigService } from '../system-config/system-config.module';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { ConfirmOrderDto } from './dto/confirm-order.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { IdempotentAttributionSafeMemberBenefitOrderService } from './idempotent-attribution-safe-member-benefit-order.service';
import {
  lockActiveCheckoutUser,
  lockActivePickupStore,
  settleExpiredPointsBeforeCheckout,
  withLockedPickupStoreSnapshot,
} from './pickup-order-guard';

type OrderCreateContext = {
  userId: bigint;
  pickupStoreId?: bigint;
  pointsDeduct?: number;
};

/**
 * Legacy OrderService seeds a CREATED WeChat payment row inside the order-create transaction.
 * That row is indistinguishable from a payment that the user actually started, while the
 * cancellation safety layer intentionally blocks any non-failed payment record. Production
 * checkout therefore defers the positive-amount WeChat record until PaymentService is called.
 *
 * Keep zero-pay and any future non-WeChat payment writes untouched. PaymentService already owns
 * the unique orderId race and creates/reuses the durable WeChat payment record atomically when
 * payment is genuinely initiated.
 */
export function withDeferredWechatPaymentSeed(tx: any): any {
  const orderPayment = tx?.orderPayment;
  if (!orderPayment || typeof orderPayment.create !== 'function') return tx;

  const originalCreate = orderPayment.create.bind(orderPayment);
  const guardedOrderPayment = new Proxy(orderPayment, {
    get(target, property, receiver) {
      if (property !== 'create') return Reflect.get(target, property, receiver);
      return async (args: any) => {
        const data = args?.data;
        const isPrematureWechatSeed =
          data?.paymentMethod === 'wechat'
          && data?.status === PAYMENT_STATUS.CREATED
          && Number(data?.amount) > 0;

        if (isPrematureWechatSeed) {
          // OrderService ignores the create result and only needs the write to complete. Returning
          // the would-be data keeps the legacy control flow intact without persisting a false
          // "payment initiated" fact.
          return { ...data };
        }
        return originalCreate(args);
      };
    },
  });

  return new Proxy(tx, {
    get(target, property, receiver) {
      if (property === 'orderPayment') return guardedOrderPayment;
      return Reflect.get(target, property, receiver);
    },
  });
}

export function installPickupStoreTransactionGuard(
  prisma: PrismaService,
  storage: AsyncLocalStorage<OrderCreateContext>,
): void {
  const originalTransaction = prisma.$transaction.bind(prisma) as any;

  (prisma as any).$transaction = ((input: any, ...rest: any[]) => {
    const context = storage.getStore();
    if (!context || typeof input !== 'function') {
      return originalTransaction(input, ...rest);
    }

    return originalTransaction(async (tx: any) => {
      await lockActiveCheckoutUser(tx, context.userId);
      if ((context.pointsDeduct ?? 0) > 0) {
        await settleExpiredPointsBeforeCheckout(tx, context.userId);
      }

      const scopedTx = context.pickupStoreId
        ? withLockedPickupStoreSnapshot(
            tx,
            await lockActivePickupStore(tx, context.pickupStoreId),
          )
        : tx;

      return input(withDeferredWechatPaymentSeed(scopedTx));
    }, ...rest);
  }) as any;
}

@Injectable()
export class PickupSafeIdempotentAttributionSafeMemberBenefitOrderService
  extends IdempotentAttributionSafeMemberBenefitOrderService {
  private readonly pickupOrderContext = new AsyncLocalStorage<OrderCreateContext>();

  constructor(
    private readonly orderCountPrisma: PrismaService,
    businessEventService: BusinessEventService,
    benefitPackageService: BenefitPackageService,
    groupBuyService: GroupBuyService,
    flashSaleService: FlashSaleService,
    redisService: RedisService,
    @Optional() systemConfigService?: SystemConfigService,
  ) {
    super(
      orderCountPrisma,
      businessEventService,
      benefitPackageService,
      groupBuyService,
      flashSaleService,
      redisService,
      systemConfigService,
    );

    const runtimePrisma = (this as any).productionPrisma as PrismaService | undefined;
    if (!runtimePrisma || typeof runtimePrisma.$transaction !== 'function') {
      throw new Error('OrderService checkout transaction guard is unavailable');
    }
    installPickupStoreTransactionGuard(runtimePrisma, this.pickupOrderContext);
  }

  override async confirm(userId: string, dto: ConfirmOrderDto) {
    const userIdValue = parsePositiveBigIntId(userId, '用户');
    const fulfillmentType = dto.fulfillmentType || 'delivery';
    if (fulfillmentType === 'delivery' && dto.addressId) {
      const addressId = parsePositiveBigIntId(dto.addressId, '收货地址');
      const address = await this.orderCountPrisma.userAddress.findFirst({
        where: {
          id: addressId,
          userId: userIdValue,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!address) {
        throw new BadRequestException('收货地址不存在或已失效，请重新选择');
      }
    }

    // Keep the preview honest too. This is repeated inside create's locked transaction because a
    // preview is never an authorization boundary and another points mutation may happen afterwards.
    if ((dto.pointsDeduct ?? 0) > 0) {
      await this.orderCountPrisma.$transaction(async (tx: any) => {
        await lockActiveCheckoutUser(tx, userIdValue);
        await settleExpiredPointsBeforeCheckout(tx, userIdValue);
      });
    }

    return super.confirm(userId, dto);
  }

  override async getOrderCountByUser(userId: string) {
    const userIdValue = parsePositiveBigIntId(userId, '用户');
    const [counts, paid] = await Promise.all([
      super.getOrderCountByUser(userId),
      this.orderCountPrisma.order.count({
        where: { userId: userIdValue, status: OrderStatus.paid },
      }),
    ]);

    return { ...counts, paid };
  }

  override async create(userId: string, dto: CreateOrderDto) {
    const userIdValue = parsePositiveBigIntId(userId, '用户');
    const fulfillmentType = dto.fulfillmentType || 'delivery';
    const pickupStoreId = fulfillmentType === 'pickup'
      ? parsePositiveBigIntId(String(dto.pickupStoreId || ''), '自提点')
      : undefined;

    return this.pickupOrderContext.run(
      {
        userId: userIdValue,
        pickupStoreId,
        pointsDeduct: dto.pointsDeduct,
      },
      () => super.create(userId, dto),
    );
  }
}
