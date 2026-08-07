import { BadRequestException, forwardRef, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { BenefitPackageService } from '../benefit-package/benefit-package.service';
import { OrderService } from '../order/order.service';
import { PromotionCheckoutService } from '../order/promotion-checkout.service';
import { GroupBuyActivityDto, JoinGroupBuyDto, StartGroupBuyDto } from './dto/group-buy.dto';
import { TransactionalGroupBuyService } from './transactional-group-buy.service';

@Injectable()
export class ProductionGroupBuyService extends TransactionalGroupBuyService {
  constructor(
    private readonly productionPrisma: PrismaService,
    @Inject(forwardRef(() => OrderService))
    orderService: OrderService,
    promotionCheckout: PromotionCheckoutService,
    benefitPackageService: BenefitPackageService,
  ) {
    super(productionPrisma, orderService, promotionCheckout, benefitPackageService);
  }

  override async createActivity(dto: GroupBuyActivityDto) {
    await this.assertPromotionFulfillmentSupported(dto.skuId);
    return super.createActivity(dto);
  }

  override async updateActivity(id: string, dto: GroupBuyActivityDto) {
    await this.assertPromotionFulfillmentSupported(dto.skuId);
    return super.updateActivity(id, dto);
  }

  override async startGroupBuy(userId: string, dto: StartGroupBuyDto) {
    const result: any = await super.startGroupBuy(userId, dto);
    return this.attachCheckoutState(result);
  }

  override async joinGroupBuy(userId: string, dto: JoinGroupBuyDto) {
    const result: any = await super.joinGroupBuy(userId, dto);
    return this.attachCheckoutState(result);
  }

  private async assertPromotionFulfillmentSupported(skuIdInput: string) {
    const skuId = parsePositiveBigIntId(skuIdInput, 'SKU ');
    const sku = await this.productionPrisma.productSku.findFirst({
      where: { id: skuId, status: 1 },
      include: { product: true },
    });
    const fulfillmentType = sku?.product?.fulfillmentType || 'delivery';
    if (!sku || !['delivery', 'pickup'].includes(fulfillmentType)) {
      throw new BadRequestException('拼团活动仅支持快递配送或到店自提商品');
    }
  }

  private async attachCheckoutState(result: any) {
    const order = await this.productionPrisma.order.findUnique({
      where: { id: BigInt(result.orderId) },
      select: { payAmount: true, status: true, fulfillmentType: true },
    });
    return {
      ...result,
      isZeroPay: (order?.payAmount ?? 0) === 0,
      orderStatus: order?.status ?? null,
      fulfillmentType: order?.fulfillmentType ?? null,
    };
  }
}
