import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { BusinessEventService } from '../common/business-event.service';
import { RedisService } from '../common/redis/redis.service';
import { BenefitPackageService } from '../benefit-package/benefit-package.service';
import { FlashSaleService } from '../flash-sale/flash-sale.service';
import { GroupBuyService } from '../group-buy/group-buy.service';
import { SystemConfigService } from '../system-config/system-config.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { MemberBenefitProductionOrderService } from './member-benefit-production-order.service';
import { resolveCreateOrderAttribution } from './order-attribution';

/**
 * Outermost normal-order provider.
 *
 * It resolves only the attribution snapshot for a NEW order, then delegates every pricing,
 * inventory, coupon, points, cancellation and member-level invariant to the existing hardened
 * order chain. Historical orders are never re-resolved, so disabling a merchant source cannot
 * retroactively erase commission eligibility already earned before the source was stopped.
 */
@Injectable()
export class AttributionSafeMemberBenefitOrderService extends MemberBenefitProductionOrderService {
  constructor(
    private readonly attributionPrisma: PrismaService,
    businessEventService: BusinessEventService,
    benefitPackageService: BenefitPackageService,
    groupBuyService: GroupBuyService,
    flashSaleService: FlashSaleService,
    redisService: RedisService,
    @Optional() systemConfigService?: SystemConfigService,
  ) {
    super(
      attributionPrisma,
      businessEventService,
      benefitPackageService,
      groupBuyService,
      flashSaleService,
      redisService,
      systemConfigService,
    );
  }

  override async create(userId: string, dto: CreateOrderDto) {
    const resolvedDto = await resolveCreateOrderAttribution(this.attributionPrisma, dto);
    return super.create(userId, resolvedDto);
  }
}
