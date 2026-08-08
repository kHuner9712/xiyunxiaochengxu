import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { ProductionActivityService } from './production-activity.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';

const EXECUTABLE_TYPES = new Set(['1', '2', '5']);

@Injectable()
export class CheckoutReadyProductionActivityService extends ProductionActivityService {
  constructor(private readonly checkoutPrisma: PrismaService) {
    super(checkoutPrisma);
  }

  override async findActive() {
    const list: any[] = await super.findActive();
    return list.filter((activity) => EXECUTABLE_TYPES.has(String(activity.type)));
  }

  override async findByType(type: string) {
    if (!EXECUTABLE_TYPES.has(String(type))) return [];
    return super.findByType(type);
  }

  override async findPublishedById(id: string) {
    const result: any = await super.findPublishedById(id);
    if (!EXECUTABLE_TYPES.has(String(result.type))) {
      throw new NotFoundException('活动不存在或当前类型尚未开放购买');
    }
    return result;
  }

  override async create(data: CreateActivityDto) {
    this.assertExecutableDefinition(data);
    return super.create(data);
  }

  override async update(id: string, data: UpdateActivityDto) {
    const activityId = parsePositiveBigIntId(id, '活动');
    const current = await this.checkoutPrisma.activity.findUnique({
      where: { id: activityId },
      include: { activityProducts: true },
    });
    if (!current || current.status === 4) throw new NotFoundException('活动不存在');
    const finalDefinition: any = {
      type: data.type ?? current.type,
      rules: data.rules ?? current.rules,
      products: data.products ?? current.activityProducts.map((item) => ({
        productId: item.productId.toString(),
        skuId: item.skuId?.toString(),
        activityPrice: item.activityPrice,
        activityStock: item.activityStock,
        limitPerUser: item.limitPerUser,
      })),
    };
    this.assertExecutableDefinition(finalDefinition);
    return super.update(id, data);
  }

  override async updateStatus(id: string, status: number) {
    if (status === 1) {
      const activityId = parsePositiveBigIntId(id, '活动');
      const current = await this.checkoutPrisma.activity.findUnique({
        where: { id: activityId },
        include: { activityProducts: true },
      });
      if (!current || current.status === 4) throw new NotFoundException('活动不存在');
      this.assertExecutableDefinition({
        type: current.type,
        rules: current.rules,
        products: current.activityProducts.map((item) => ({
          productId: item.productId.toString(),
          skuId: item.skuId?.toString(),
          activityPrice: item.activityPrice,
          activityStock: item.activityStock,
          limitPerUser: item.limitPerUser,
        })),
      });
      if (current.endTime.getTime() <= Date.now()) {
        throw new BadRequestException('活动已经结束，不能重新启用');
      }
    }
    return super.updateStatus(id, status);
  }

  private assertExecutableDefinition(data: {
    type: string;
    rules?: Record<string, unknown> | null | unknown;
    products?: Array<{
      productId: string;
      activityPrice?: number;
      activityStock?: number;
      limitPerUser?: number;
    }>;
  }) {
    const type = String(data.type || '');
    if (!EXECUTABLE_TYPES.has(type)) {
      throw new BadRequestException('当前仅开放已完成真实结算链的限时折扣、满减活动和新人优惠');
    }
    const products = Array.isArray(data.products) ? data.products : [];
    if (products.length === 0) throw new BadRequestException('活动至少需要配置一个活动商品');
    for (const product of products) {
      const stock = Number(product.activityStock ?? 0);
      if (!Number.isSafeInteger(stock) || stock <= 0) {
        throw new BadRequestException('活动商品必须配置大于0的活动库存');
      }
      if (type === '1' || type === '5') {
        const price = Number(product.activityPrice);
        if (!Number.isSafeInteger(price) || price < 0) {
          throw new BadRequestException('限时折扣/新人优惠必须配置有效活动价');
        }
      }
    }
    if (type === '2') {
      const rules: any = data.rules;
      const entries = Array.isArray(rules?.fullReductionRules) ? rules.fullReductionRules : [];
      if (entries.length === 0) throw new BadRequestException('满减活动至少需要一条满减规则');
      for (const rule of entries) {
        const fullAmount = Number(rule?.fullAmount);
        const reduceAmount = Number(rule?.reduceAmount);
        if (
          !Number.isSafeInteger(fullAmount) ||
          !Number.isSafeInteger(reduceAmount) ||
          fullAmount <= 0 ||
          reduceAmount <= 0 ||
          reduceAmount >= fullAmount
        ) {
          throw new BadRequestException('满减规则必须满足“门槛金额 > 减免金额 > 0”，且金额必须精确到分');
        }
      }
    }
  }
}
