import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { BusinessEventService } from '../common/business-event.service';
import { RedisService } from '../common/redis/redis.service';
import { BenefitPackageService } from '../benefit-package/benefit-package.service';
import { FlashSaleService } from '../flash-sale/flash-sale.service';
import { GroupBuyService } from '../group-buy/group-buy.service';
import { SystemConfigService } from '../system-config/system-config.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { CreateOrderDto } from './dto/create-order.dto';
import { IdempotentAttributionSafeMemberBenefitOrderService } from './idempotent-attribution-safe-member-benefit-order.service';
import { lockActivePickupStore, withLockedPickupStoreSnapshot } from './pickup-order-guard';

type PickupOrderContext = {
  pickupStoreId: bigint;
};

export function installPickupStoreTransactionGuard(
  prisma: PrismaService,
  storage: AsyncLocalStorage<PickupOrderContext>,
): void {
  const originalTransaction = prisma.$transaction.bind(prisma) as any;

  (prisma as any).$transaction = ((input: any, ...rest: any[]) => {
    const context = storage.getStore();
    if (!context || typeof input !== 'function') {
      return originalTransaction(input, ...rest);
    }

    return originalTransaction(async (tx: any) => {
      const store = await lockActivePickupStore(tx, context.pickupStoreId);
      return input(withLockedPickupStoreSnapshot(tx, store));
    }, ...rest);
  }) as any;
}

@Injectable()
export class PickupSafeIdempotentAttributionSafeMemberBenefitOrderService
  extends IdempotentAttributionSafeMemberBenefitOrderService {
  private readonly pickupOrderContext = new AsyncLocalStorage<PickupOrderContext>();

  constructor(
    prisma: PrismaService,
    businessEventService: BusinessEventService,
    benefitPackageService: BenefitPackageService,
    groupBuyService: GroupBuyService,
    flashSaleService: FlashSaleService,
    redisService: RedisService,
    @Optional() systemConfigService?: SystemConfigService,
  ) {
    super(
      prisma,
      businessEventService,
      benefitPackageService,
      groupBuyService,
      flashSaleService,
      redisService,
      systemConfigService,
    );

    const runtimePrisma = (this as any).productionPrisma as PrismaService | undefined;
    if (!runtimePrisma || typeof runtimePrisma.$transaction !== 'function') {
      throw new Error('OrderService pickup transaction guard is unavailable');
    }
    installPickupStoreTransactionGuard(runtimePrisma, this.pickupOrderContext);
  }

  override async create(userId: string, dto: CreateOrderDto) {
    const fulfillmentType = dto.fulfillmentType || 'delivery';
    if (fulfillmentType !== 'pickup') {
      return super.create(userId, dto);
    }

    const pickupStoreId = parsePositiveBigIntId(String(dto.pickupStoreId || ''), '自提点');
    return this.pickupOrderContext.run(
      { pickupStoreId },
      () => super.create(userId, dto),
    );
  }
}
