import { BadRequestException, forwardRef, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { BenefitPackageService } from '../benefit-package/benefit-package.service';
import { OrderService } from '../order/order.service';
import { PromotionCheckoutService } from '../order/promotion-checkout.service';
import { FlashSaleActivityDto, FlashSaleBuyDto } from './dto/flash-sale.dto';
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

  private async assertPromotionFulfillmentSupported(skuIdInput: string) {
    const skuId = parsePositiveBigIntId(skuIdInput, 'SKU ');
    const sku = await this.productionPrisma.productSku.findFirst({
      where: { id: skuId, status: 1 },
      include: { product: true },
    });
    const fulfillmentType = sku?.product?.fulfillmentType || 'delivery';
    if (!sku || !['delivery', 'pickup'].includes(fulfillmentType)) {
      throw new BadRequestException('秒杀活动仅支持快递配送或到店自提商品');
    }
  }
}
