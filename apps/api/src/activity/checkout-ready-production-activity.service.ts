import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { normalizeAssetUrl } from '../common/utils/asset-url';
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
    return list
      .filter((activity) => EXECUTABLE_TYPES.has(String(activity.type)))
      .map((activity) => this.normalizeActivityProducts(activity));
  }

  override async findByType(type: string) {
    if (!EXECUTABLE_TYPES.has(String(type))) return [];
    const list: any[] = await super.findByType(type);
    return list.map((activity) => this.normalizeActivityProducts(activity));
  }

  override async findById(id: string) {
    const result: any = await super.findById(id);
    return this.normalizeActivityProducts(result);
  }

  override async findPublishedById(id: string) {
    const result: any = await super.findPublishedById(id);
    if (!EXECUTABLE_TYPES.has(String(result.type))) {
      throw new NotFoundException('活动不存在或当前类型尚未开放购买');
    }
    return this.normalizeActivityProducts(result);
  }

  override async create(data: CreateActivityDto) {
    this.assertExecutableDefinition(data);
    const result: any = await super.create(data);
    return this.normalizeActivityProducts(result);
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
    const result: any = await super.update(id, data);
    return this.normalizeActivityProducts(result);
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

  private normalizeActivityProducts(activity: any) {
    if (!activity) return activity;
    const relations = Array.isArray(activity.activityProducts)
      ? activity.activityProducts
      : Array.isArray(activity.products)
        ? activity.products
        : [];
    const products = relations.map((item: any) => {
      const product = item.product || {};
      const sku = item.sku || {};
      const productId = String(item.productId ?? product.id ?? '');
      const skuId = item.skuId ? String(item.skuId) : sku.id ? String(sku.id) : null;
      const activityProductId = String(item.activityProductId ?? item.id ?? '');
      const originalPrice = Number(sku.price ?? item.originalPrice ?? product.minPrice ?? 0);
      const activityPrice = Number(item.activityPrice ?? originalPrice);
      const activityStock = Number(item.activityStock ?? 0);
      const skuStock = Number(sku.stock ?? activityStock);
      return {
        activityProductId,
        id: productId,
        productId,
        skuId,
        name: item.name || product.name || '',
        image: normalizeAssetUrl(item.image || sku.image || product.mainImage || ''),
        originalPrice,
        price: String(activity.type) === '2' ? originalPrice : activityPrice,
        activityPrice,
        activityStock,
        stock: Math.max(0, Math.min(activityStock, skuStock)),
        limitPerUser: Number(item.limitPerUser || 0),
        sales: Number(item.sales || product.totalSales || 0),
        sku: skuId ? {
          id: skuId,
          specs: sku.specs ?? null,
          price: originalPrice,
          stock: skuStock,
          status: sku.status,
        } : null,
      };
    });
    return { ...activity, products };
  }

  private assertExecutableDefinition(data: {
    type: string;
    rules?: Record<string, unknown> | null | unknown;
    products?: Array<{
      productId: string;
      skuId?: string;
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
      if (!product.skuId || !/^[1-9]\d*$/.test(String(product.skuId))) {
        throw new BadRequestException('可购买活动商品必须绑定具体SKU，不能使用模糊的商品级价格/库存');
      }
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
