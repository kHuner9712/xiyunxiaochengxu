import { AsyncLocalStorage } from 'node:async_hooks';
import {
  forwardRef,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  buildPromotionCheckoutOrderNo,
  createPromotionCheckoutPrismaProxy,
  normalizePromotionClientRequestId,
  PromotionCheckoutIdempotencyContext,
} from '../common/utils/promotion-checkout-idempotency';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { BenefitPackageService } from '../benefit-package/benefit-package.service';
import { OrderService } from '../order/order.service';
import { PromotionCheckoutService } from '../order/promotion-checkout.service';
import { FlashSaleBuyDto } from './dto/flash-sale.dto';
import { ProductionFlashSaleService } from './production-flash-sale.service';

@Injectable()
export class IdempotentProductionFlashSaleService extends ProductionFlashSaleService {
  private readonly idempotencyStorage: AsyncLocalStorage<PromotionCheckoutIdempotencyContext>;
  private readonly sourcePrisma: PrismaService;

  constructor(
    prisma: PrismaService,
    @Inject(forwardRef(() => OrderService))
    orderService: OrderService,
    promotionCheckout: PromotionCheckoutService,
    benefitPackageService: BenefitPackageService,
  ) {
    const storage = new AsyncLocalStorage<PromotionCheckoutIdempotencyContext>();
    super(
      createPromotionCheckoutPrismaProxy(prisma, storage),
      orderService,
      promotionCheckout,
      benefitPackageService,
    );
    this.sourcePrisma = prisma;
    this.idempotencyStorage = storage;
  }

  override async weappBuy(userId: string, dto: FlashSaleBuyDto) {
    const userIdValue = parsePositiveBigIntId(userId, '用户');
    const activityId = parsePositiveBigIntId(dto.activityId, '活动');
    const clientRequestId = normalizePromotionClientRequestId(dto.clientRequestId);
    const orderNo = buildPromotionCheckoutOrderNo(
      userIdValue,
      `flash-sale:${activityId}`,
      clientRequestId,
    );

    const existing = await this.recoverCheckout(userIdValue, orderNo);
    if (existing) return existing;

    try {
      return await this.idempotencyStorage.run(
        { userId: userIdValue.toString(), orderNo },
        () => super.weappBuy(userId, dto),
      );
    } catch (error) {
      // Concurrent retries can both pass the pre-read. The order_no unique key is the final arbiter
      // inside the existing flash-sale transaction; the loser rolls back inventory/locked_count and
      // recovers the winner here. If no committed winner exists, preserve the real business error.
      const recovered = await this.recoverCheckout(userIdValue, orderNo);
      if (recovered) return recovered;
      throw error;
    }
  }

  private async recoverCheckout(userId: bigint, orderNo: string) {
    const order = await this.sourcePrisma.order.findFirst({
      where: { orderNo, userId },
      select: {
        id: true,
        payAmount: true,
        status: true,
        fulfillmentType: true,
      },
    });
    if (!order) return null;

    const flashSaleOrder = await this.sourcePrisma.flashSaleOrder.findFirst({
      where: { orderId: order.id, userId, deletedAt: null },
      select: {
        id: true,
        quantity: true,
        flashPrice: true,
        lockExpireAt: true,
      },
    });
    if (!flashSaleOrder) {
      throw new InternalServerErrorException('秒杀幂等订单缺少业务记录，请联系管理员核查');
    }

    return {
      flashSaleOrderId: flashSaleOrder.id.toString(),
      orderId: order.id.toString(),
      flashPrice: flashSaleOrder.flashPrice,
      quantity: flashSaleOrder.quantity,
      lockExpireAt: flashSaleOrder.lockExpireAt.toISOString(),
      isZeroPay: order.payAmount === 0,
      orderStatus: order.status,
      fulfillmentType: order.fulfillmentType,
    };
  }
}
