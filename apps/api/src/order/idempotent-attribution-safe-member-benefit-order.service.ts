import { AsyncLocalStorage } from 'node:async_hooks';
import * as crypto from 'node:crypto';
import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { BusinessEventService } from '../common/business-event.service';
import { RedisService } from '../common/redis/redis.service';
import { BenefitPackageService } from '../benefit-package/benefit-package.service';
import { FlashSaleService } from '../flash-sale/flash-sale.service';
import { GroupBuyService } from '../group-buy/group-buy.service';
import { SystemConfigService } from '../system-config/system-config.service';
import { AttributionSafeMemberBenefitOrderService } from './attribution-safe-member-benefit-order.service';
import { CreateOrderDto } from './dto/create-order.dto';

interface OrderCreateIdempotencyContext {
  userId: string;
  orderNo: string;
}

function proxyTransactionOrderCreate(tx: any, context: OrderCreateIdempotencyContext) {
  const orderDelegate = tx.order;
  const orderProxy = new Proxy(orderDelegate, {
    get(target, property) {
      if (property === 'create') {
        return async (args: any) => {
          const sameUser = args?.data?.userId?.toString?.() === context.userId;
          if (!sameUser) return target.create(args);
          return target.create({
            ...args,
            data: {
              ...args.data,
              orderNo: context.orderNo,
            },
          });
        };
      }
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });

  return new Proxy(tx, {
    get(target, property) {
      if (property === 'order') return orderProxy;
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

export function createOrderIdempotencyPrismaProxy(
  prisma: PrismaService,
  storage: AsyncLocalStorage<OrderCreateIdempotencyContext>,
): PrismaService {
  return new Proxy(prisma as any, {
    get(target, property) {
      if (property !== '$transaction') {
        const value = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
      }

      return (input: any, ...rest: any[]) => {
        const originalTransaction = Reflect.get(target, '$transaction', target);
        if (typeof originalTransaction !== 'function') {
          throw new TypeError('PrismaService.$transaction is not available');
        }

        const context = storage.getStore();
        if (!context || typeof input !== 'function') {
          return originalTransaction.call(target, input, ...rest);
        }

        return originalTransaction.call(
          target,
          async (tx: any) => input(proxyTransactionOrderCreate(tx, context)),
          ...rest,
        );
      };
    },
  }) as PrismaService;
}

@Injectable()
export class IdempotentAttributionSafeMemberBenefitOrderService extends AttributionSafeMemberBenefitOrderService {
  private readonly orderCreateIdempotency: AsyncLocalStorage<OrderCreateIdempotencyContext>;
  private readonly idempotentPrisma: PrismaService;

  constructor(
    idempotentPrisma: PrismaService,
    businessEventService: BusinessEventService,
    benefitPackageService: BenefitPackageService,
    groupBuyService: GroupBuyService,
    flashSaleService: FlashSaleService,
    redisService: RedisService,
    @Optional() systemConfigService?: SystemConfigService,
  ) {
    const orderCreateIdempotency = new AsyncLocalStorage<OrderCreateIdempotencyContext>();
    super(
      createOrderIdempotencyPrismaProxy(idempotentPrisma, orderCreateIdempotency),
      businessEventService,
      benefitPackageService,
      groupBuyService,
      flashSaleService,
      redisService,
      systemConfigService,
    );
    this.idempotentPrisma = idempotentPrisma;
    this.orderCreateIdempotency = orderCreateIdempotency;
  }

  override async create(userId: string, dto: CreateOrderDto) {
    const clientRequestId = String(dto.clientRequestId || '').trim();
    if (!/^\d{13}-[a-z0-9]{16,40}$/i.test(clientRequestId)) {
      throw new BadRequestException('下单请求标识格式无效');
    }

    const orderNo = this.buildDeterministicOrderNo(userId, clientRequestId);
    const existing = await this.findIdempotentOrder(userId, orderNo);
    if (existing) return existing;

    try {
      return await this.orderCreateIdempotency.run(
        { userId, orderNo },
        () => super.create(userId, dto),
      );
    } catch (error) {
      // Two identical retries can both pass the pre-read. The database unique key on order_no is
      // the final arbiter inside the existing stock/coupon/points transaction: the loser rolls its
      // entire transaction back, then returns the order committed by the winner.
      const recovered = await this.findIdempotentOrder(userId, orderNo);
      if (recovered) return recovered;
      throw error;
    }
  }

  private async findIdempotentOrder(userId: string, orderNo: string) {
    const order = await this.idempotentPrisma.order.findFirst({
      where: {
        orderNo,
        userId: BigInt(userId),
      },
      select: {
        id: true,
        orderNo: true,
        payAmount: true,
        status: true,
        fulfillmentType: true,
      },
    });
    if (!order) return null;

    return {
      orderId: order.id.toString(),
      orderNo: order.orderNo,
      payAmount: order.payAmount,
      isZeroPay: order.payAmount === 0,
      status: order.status,
      fulfillmentType: order.fulfillmentType,
    };
  }

  private buildDeterministicOrderNo(userId: string, clientRequestId: string): string {
    const submittedAtMs = Number(clientRequestId.slice(0, 13));
    if (!Number.isSafeInteger(submittedAtMs) || submittedAtMs <= 0) {
      throw new BadRequestException('下单请求标识时间无效');
    }

    // Preserve the existing XY + yyyyMMddHHmmss convention. Use a fixed UTC+8 conversion so the
    // same clientRequestId maps to the same order number in CI, local development and production.
    const chinaTime = new Date(submittedAtMs + 8 * 60 * 60 * 1000);
    const timestamp = [
      chinaTime.getUTCFullYear(),
      String(chinaTime.getUTCMonth() + 1).padStart(2, '0'),
      String(chinaTime.getUTCDate()).padStart(2, '0'),
      String(chinaTime.getUTCHours()).padStart(2, '0'),
      String(chinaTime.getUTCMinutes()).padStart(2, '0'),
      String(chinaTime.getUTCSeconds()).padStart(2, '0'),
    ].join('');
    const suffix = crypto
      .createHash('sha256')
      .update(`${userId}:${clientRequestId}`)
      .digest('hex')
      .slice(0, 12);
    return `XY${timestamp}${suffix}`;
  }
}
