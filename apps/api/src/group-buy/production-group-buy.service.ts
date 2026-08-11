import { BadRequestException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { BenefitPackageService } from '../benefit-package/benefit-package.service';
import { OrderService } from '../order/order.service';
import { PromotionCheckoutService } from '../order/promotion-checkout.service';
import {
  GroupBuyActivityDto,
  GroupBuyActivityStatusDto,
  JoinGroupBuyDto,
  StartGroupBuyDto,
} from './dto/group-buy.dto';
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

  override async updateActivityStatus(id: string, dto: GroupBuyActivityStatusDto) {
    if (dto.status === 1) {
      await this.assertActivityCanBeEnabled(id);
    }
    return super.updateActivityStatus(id, dto);
  }

  override async startGroupBuy(userId: string, dto: StartGroupBuyDto) {
    const result: any = await super.startGroupBuy(userId, dto);
    return this.attachCheckoutState(result);
  }

  override async joinGroupBuy(userId: string, dto: JoinGroupBuyDto) {
    const result: any = await super.joinGroupBuy(userId, dto);
    return this.attachCheckoutState(result);
  }

  private async assertActivityCanBeEnabled(id: string) {
    const activityId = parsePositiveBigIntId(id, '活动');
    const activity = await this.productionPrisma.groupBuyActivity.findFirst({
      where: { id: activityId, deletedAt: null },
      select: {
        id: true,
        productId: true,
        skuId: true,
        groupPrice: true,
        endTime: true,
      },
    });
    if (!activity) throw new NotFoundException('拼团活动不存在');
    if (activity.endTime.getTime() <= Date.now()) {
      throw new BadRequestException('活动已结束，不能重新上架，请调整结束时间后再上架');
    }
    if (!activity.skuId) {
      throw new BadRequestException('活动未绑定有效SKU，不能上架');
    }

    const sku = await this.productionPrisma.productSku.findFirst({
      where: { id: activity.skuId, status: 1 },
      include: { product: true },
    });
    if (!sku || sku.product.status !== 1) {
      throw new BadRequestException('活动商品或SKU已下架，不能上架');
    }
    if (sku.productId !== activity.productId) {
      throw new BadRequestException('活动SKU与商品不匹配，不能上架');
    }
    if (activity.groupPrice > sku.price) {
      throw new BadRequestException('拼团价高于当前SKU价格，不能上架');
    }
    const fulfillmentType = sku.product.fulfillmentType || 'delivery';
    if (!['delivery', 'pickup'].includes(fulfillmentType)) {
      throw new BadRequestException('该商品履约方式不支持拼团活动');
    }
  }

  private async assertPromotionFulfillmentSupported(skuIdInput: string) {
    const skuId = parsePositiveBigIntId(skuIdInput, 'SKU ');
    const sku = await this.productionPrisma.productSku.findFirst({
      where: { id: skuId, status: 1 },
      include: { product: true },
    });
    const fulfillmentType = sku?.product?.fulfillmentType || 'delivery';
    if (!sku || sku.product.status !== 1 || !['delivery', 'pickup'].includes(fulfillmentType)) {
      throw new BadRequestException('拼团活动仅支持已上架且可快递配送或到店自提的商品');
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
