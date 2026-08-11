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
import { JoinGroupBuyDto, StartGroupBuyDto } from './dto/group-buy.dto';
import { BigintSafeProductionGroupBuyService } from './bigint-safe-production-group-buy.service';

@Injectable()
export class IdempotentBigintSafeProductionGroupBuyService extends BigintSafeProductionGroupBuyService {
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

  override async startGroupBuy(userId: string, dto: StartGroupBuyDto) {
    const userIdValue = parsePositiveBigIntId(userId, '用户');
    const activityId = parsePositiveBigIntId(dto.activityId, '活动');
    const clientRequestId = normalizePromotionClientRequestId(dto.clientRequestId);
    const orderNo = buildPromotionCheckoutOrderNo(
      userIdValue,
      `group-buy:start:${activityId}`,
      clientRequestId,
    );
    return this.runIdempotentCheckout(
      userIdValue,
      orderNo,
      () => super.startGroupBuy(userId, dto),
    );
  }

  override async joinGroupBuy(userId: string, dto: JoinGroupBuyDto) {
    const userIdValue = parsePositiveBigIntId(userId, '用户');
    const groupId = parsePositiveBigIntId(dto.groupId, '团');
    const clientRequestId = normalizePromotionClientRequestId(dto.clientRequestId);
    const orderNo = buildPromotionCheckoutOrderNo(
      userIdValue,
      `group-buy:join:${groupId}`,
      clientRequestId,
    );
    return this.runIdempotentCheckout(
      userIdValue,
      orderNo,
      () => super.joinGroupBuy(userId, dto),
    );
  }

  private async runIdempotentCheckout(
    userId: bigint,
    orderNo: string,
    create: () => Promise<any>,
  ) {
    const existing = await this.recoverCheckout(userId, orderNo);
    if (existing) return existing;

    try {
      return await this.idempotencyStorage.run(
        { userId: userId.toString(), orderNo },
        create,
      );
    } catch (error) {
      // A concurrent retry that loses the order_no unique-key race must not become a second group
      // or consume another participation slot. Its whole transaction rolls back, then it returns the
      // committed member/order created by the winner. Other failures remain visible.
      const recovered = await this.recoverCheckout(userId, orderNo);
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

    const member = await this.sourcePrisma.groupBuyMember.findFirst({
      where: { orderId: order.id, userId, deletedAt: null },
      select: { groupId: true, role: true },
    });
    if (!member) {
      throw new InternalServerErrorException('拼团幂等订单缺少成员记录，请联系管理员核查');
    }
    const group = await this.sourcePrisma.groupBuyGroup.findUnique({
      where: { id: member.groupId },
      select: { id: true, groupNo: true },
    });
    if (!group) {
      throw new InternalServerErrorException('拼团幂等订单缺少团记录，请联系管理员核查');
    }

    return {
      groupId: group.id.toString(),
      groupNo: group.groupNo,
      orderId: order.id.toString(),
      role: member.role,
      isZeroPay: order.payAmount === 0,
      orderStatus: order.status,
      fulfillmentType: order.fulfillmentType,
    };
  }
}
