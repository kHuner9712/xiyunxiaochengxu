import { BadRequestException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { BenefitPackageService } from '../benefit-package/benefit-package.service';
import { OrderService } from '../order/order.service';
import { PromotionCheckoutService } from '../order/promotion-checkout.service';
import {
  FlashSaleActivityDto,
  FlashSaleActivityStatusDto,
  FlashSaleBuyDto,
} from './dto/flash-sale.dto';
import { TransactionalFlashSaleService } from './transactional-flash-sale.service';

@Injectable()
export class ProductionFlashSaleService extends TransactionalFlashSaleService {
  constructor(
    private readonly productionPrisma: PrismaService,
    @Inject(forwardRef(() => OrderService))
    orderService: OrderService,
    promotionCheckout: PromotionCheckoutService,
    benefitPackageService: BenefitPackageService,
  ) {
    super(productionPrisma, orderService, promotionCheckout, benefitPackageService);
  }

  override async createActivity(dto: FlashSaleActivityDto) {
    await this.assertPromotionFulfillmentSupported(dto.skuId);
    return super.createActivity(dto);
  }

  override async updateActivity(id: string, dto: FlashSaleActivityDto) {
    await this.assertPromotionFulfillmentSupported(dto.skuId);
    return super.updateActivity(id, dto);
  }

  override async updateActivityStatus(id: string, dto: FlashSaleActivityStatusDto) {
    if (dto.status === 1) {
      await this.assertActivityCanBeEnabled(id);
    }
    return super.updateActivityStatus(id, dto);
  }

  override async weappFindActivityById(id: string) {
    const activity = await super.weappFindActivityById(id);
    if (activity.status !== 1) {
      throw new NotFoundException('秒杀活动不存在或已下架');
    }
    return activity;
  }

  override async weappBuy(userId: string, dto: FlashSaleBuyDto) {
    const result: any = await super.weappBuy(userId, dto);
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

  private async assertActivityCanBeEnabled(id: string) {
    const activityId = parsePositiveBigIntId(id, '活动');
    const activity = await this.productionPrisma.flashSaleActivity.findFirst({
      where: { id: activityId, deletedAt: null },
      select: {
        id: true,
        productId: true,
        skuId: true,
        flashPrice: true,
        stockLimit: true,
        soldCount: true,
        lockedCount: true,
        endTime: true,
      },
    });
    if (!activity) throw new NotFoundException('秒杀活动不存在');
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
    if (activity.flashPrice > sku.price) {
      throw new BadRequestException('秒杀价高于当前SKU价格，不能上架');
    }
    if (activity.stockLimit <= 0) {
      throw new BadRequestException('秒杀活动库存配置无效，不能上架');
    }
    if (activity.soldCount + activity.lockedCount > activity.stockLimit) {
      throw new BadRequestException('活动已售与锁定数量超过活动库存，请先调整库存后再上架');
    }
    const fulfillmentType = sku.product.fulfillmentType || 'delivery';
    if (!['delivery', 'pickup'].includes(fulfillmentType)) {
      throw new BadRequestException('该商品履约方式不支持秒杀活动');
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
      throw new BadRequestException('秒杀活动仅支持已上架且可快递配送或到店自提的商品');
    }
  }
}
