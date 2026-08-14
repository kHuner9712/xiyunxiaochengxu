import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { normalizeAssetUrl } from '../common/utils/asset-url';
import { ACTIVITY_CREATE_EVENT, ProductionActivityService } from './production-activity.service';
import { ActivityProductDto, CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';

const EXECUTABLE_TYPES = new Set(['1', '2', '3', '4', '5']);
const ACTIVITY_PRODUCT_REMOVE_EVENT = 'activity_product_remove';

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
      throw new NotFoundException('活动不存在或活动类型无效');
    }
    return this.normalizeActivityProducts(result);
  }

  override async create(data: CreateActivityDto) {
    if (data.clientRequestId) {
      const handled = await this.checkoutPrisma.businessEvent.findFirst({
        where: {
          eventType: ACTIVITY_CREATE_EVENT,
          bizType: 'activity',
          bizId: data.clientRequestId.trim(),
        },
        select: { id: true },
      });
      if (handled) {
        const replay: any = await super.create(data);
        return this.normalizeActivityProducts(replay);
      }
    }
    await this.assertExecutableDefinition(data);
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
    const finalDefinition = {
      type: data.type ?? current.type,
      rules: data.rules ?? current.rules,
      products: data.products ?? current.activityProducts.map((item) => ({
        productId: item.productId.toString(),
        skuId: item.skuId?.toString(),
        activityPrice: item.activityPrice ?? undefined,
        activityStock: item.activityStock ?? undefined,
        limitPerUser: item.limitPerUser,
      })),
    };
    await this.assertExecutableDefinition(finalDefinition);
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
      await this.assertExecutableDefinition({
        type: current.type,
        rules: current.rules,
        products: current.activityProducts.map((item) => ({
          productId: item.productId.toString(),
          skuId: item.skuId?.toString(),
          activityPrice: item.activityPrice ?? undefined,
          activityStock: item.activityStock ?? undefined,
          limitPerUser: item.limitPerUser,
        })),
      });
      if (current.endTime.getTime() <= Date.now()) {
        throw new BadRequestException('活动已经结束，不能重新启用');
      }
    }
    return super.updateStatus(id, status);
  }

  override async addProduct(activityId: string, data: ActivityProductDto) {
    const activityIdValue = parsePositiveBigIntId(activityId, '活动');
    const result = await this.checkoutPrisma.$transaction(async (tx: any) => {
      await tx.$queryRaw`SELECT id FROM activities WHERE id = ${activityIdValue} FOR UPDATE`;
      const activity = await tx.activity.findUnique({
        where: { id: activityIdValue },
        include: { activityProducts: true },
      });
      if (!activity || activity.status === 4) throw new NotFoundException('活动不存在');

      const [normalized] = await (this as any).validateProducts(tx, [data]);
      const duplicate = activity.activityProducts.some((item: any) =>
        item.productId === normalized.productId && item.skuId === normalized.skuId,
      );
      if (duplicate) throw new BadRequestException('该商品/SKU已加入活动');

      const prospective = [
        ...activity.activityProducts.map((item: any) => this.toDefinitionProduct(item)),
        this.toDefinitionProduct(normalized),
      ];
      await this.assertExecutableDefinition({
        type: activity.type,
        rules: activity.rules,
        products: prospective,
      }, tx);

      return tx.activityProduct.create({
        data: { activityId: activityIdValue, ...normalized },
      });
    });
    return {
      ...result,
      id: result.id.toString(),
      activityId: result.activityId.toString(),
      productId: result.productId.toString(),
      skuId: result.skuId?.toString(),
    };
  }

  override async removeProduct(id: string) {
    const relationId = parsePositiveBigIntId(id, '活动商品');
    return this.checkoutPrisma.$transaction(async (tx: any) => {
      const handled = await tx.businessEvent.findFirst({
        where: {
          eventType: ACTIVITY_PRODUCT_REMOVE_EVENT,
          bizType: 'activity_product',
          bizId: relationId.toString(),
        },
        orderBy: { id: 'desc' },
      });
      if (handled) return { success: true };

      const relation = await tx.activityProduct.findUnique({ where: { id: relationId } });
      if (!relation) throw new NotFoundException('活动商品不存在');
      await tx.$queryRaw`SELECT id FROM activities WHERE id = ${relation.activityId} FOR UPDATE`;
      const activity = await tx.activity.findUnique({
        where: { id: relation.activityId },
        include: { activityProducts: true },
      });
      if (!activity || activity.status === 4) throw new NotFoundException('活动不存在');

      const remaining = activity.activityProducts
        .filter((item: any) => item.id !== relationId)
        .map((item: any) => this.toDefinitionProduct(item));
      await this.assertExecutableDefinition({
        type: activity.type,
        rules: activity.rules,
        products: remaining,
      }, tx);

      await tx.activityProduct.delete({ where: { id: relationId } });
      await tx.businessEvent.create({
        data: {
          eventType: ACTIVITY_PRODUCT_REMOVE_EVENT,
          bizType: 'activity_product',
          bizId: relationId.toString(),
          level: 'info',
          message: '活动商品删除已处理',
          payload: { activityId: relation.activityId.toString() },
        },
      });
      return { success: true };
    });
  }

  private toDefinitionProduct(item: any) {
    return {
      productId: item.productId.toString(),
      skuId: item.skuId?.toString(),
      activityPrice: item.activityPrice ?? undefined,
      activityStock: item.activityStock ?? undefined,
      limitPerUser: item.limitPerUser ?? 0,
    };
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
      const type = String(activity.type);
      return {
        activityProductId,
        id: productId,
        productId,
        skuId,
        name: item.name || product.name || '',
        image: normalizeAssetUrl(item.image || sku.image || product.mainImage || ''),
        originalPrice,
        price: type === '1' || type === '5' ? activityPrice : originalPrice,
        activityPrice,
        activityStock,
        stock: Math.max(0, Math.min(activityStock, skuStock)),
        limitPerUser: Number(item.limitPerUser || 0),
        sales: Number(item.sales || product.totalSales || 0),
        fulfillmentType: product.fulfillmentType || item.fulfillmentType || 'delivery',
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

  private async assertExecutableDefinition(data: {
    type: string;
    rules?: unknown;
    products?: Array<{
      productId: string;
      skuId?: string;
      activityPrice?: number;
      activityStock?: number;
      limitPerUser?: number;
    }>;
  }, db: any = this.checkoutPrisma) {
    const type = String(data.type || '');
    if (!EXECUTABLE_TYPES.has(type)) {
      throw new BadRequestException('活动类型无效');
    }
    const products = Array.isArray(data.products) ? data.products : [];
    if (products.length === 0) throw new BadRequestException('活动至少需要配置一个活动商品');

    const skuIds: bigint[] = [];
    const skuIdStrings = new Set<string>();
    const activityStockBySku = new Map<string, number>();
    for (const product of products) {
      if (!product.skuId || !/^[1-9]\d*$/.test(String(product.skuId))) {
        throw new BadRequestException('可购买活动商品必须绑定具体SKU，不能使用模糊的商品级价格/库存');
      }
      if (skuIdStrings.has(String(product.skuId))) {
        throw new BadRequestException('同一活动不能重复配置同一SKU');
      }
      skuIdStrings.add(String(product.skuId));
      skuIds.push(parsePositiveBigIntId(product.skuId, 'SKU'));

      const stock = Number(product.activityStock ?? 0);
      if (!Number.isSafeInteger(stock) || stock <= 0) {
        throw new BadRequestException('活动商品必须配置大于0的活动库存');
      }
      activityStockBySku.set(String(product.skuId), stock);
      if (type === '1' || type === '5') {
        const price = Number(product.activityPrice);
        if (!Number.isSafeInteger(price) || price < 0) {
          throw new BadRequestException('限时折扣/新人优惠必须配置有效活动价');
        }
      }
    }

    const skuRows = await db.productSku.findMany({
      where: { id: { in: skuIds }, status: 1 },
      include: { product: true },
    });
    if (skuRows.length !== skuIds.length || skuRows.some((sku: any) => sku.product.status !== 1)) {
      throw new BadRequestException('活动包含已下架或无效SKU');
    }
    const skuMap = new Map(skuRows.map((sku: any) => [sku.id.toString(), sku]));

    let rules: any = data.rules || {};
    if (typeof rules === 'string') {
      try { rules = JSON.parse(rules); } catch { throw new BadRequestException('活动规则配置损坏'); }
    }

    if (type === '2') {
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

    if (type === '3') {
      const entries = Array.isArray(rules?.fullGiftRules) ? rules.fullGiftRules : [];
      if (entries.length === 0) throw new BadRequestException('满赠活动至少需要一条赠品规则');
      const fulfillmentTypes = new Set(skuRows.map((sku: any) => sku.product.fulfillmentType || 'delivery'));
      if (fulfillmentTypes.size !== 1) {
        throw new BadRequestException('满赠活动的主商品与赠品必须使用相同履约方式');
      }
      for (const rule of entries) {
        const fullAmount = Number(rule?.fullAmount);
        const giftSkuId = String(rule?.giftSkuId || '');
        const giftQuantity = Number(rule?.giftQuantity);
        if (!Number.isSafeInteger(fullAmount) || fullAmount <= 0) {
          throw new BadRequestException('满赠门槛金额必须为大于0的整数分');
        }
        if (!/^[1-9]\d*$/.test(giftSkuId) || !skuIdStrings.has(giftSkuId)) {
          throw new BadRequestException('满赠规则的赠品SKU必须来自当前活动商品');
        }
        if (!Number.isSafeInteger(giftQuantity) || giftQuantity <= 0 || giftQuantity > 99) {
          throw new BadRequestException('满赠规则的赠品数量必须为1-99的整数');
        }
        if ((activityStockBySku.get(giftSkuId) || 0) < giftQuantity) {
          throw new BadRequestException('赠品活动库存不能小于单次赠送数量');
        }
      }
    }

    if (type === '4') {
      const bundlePrice = Number(rules?.bundlePrice);
      const bundleItems = Array.isArray(rules?.bundleItems) ? rules.bundleItems : [];
      if (!Number.isSafeInteger(bundlePrice) || bundlePrice < 0) {
        throw new BadRequestException('组合套餐必须配置有效套餐总价');
      }
      if (bundleItems.length < 2) {
        throw new BadRequestException('组合套餐至少需要2个SKU');
      }
      const fulfillmentTypes = new Set(skuRows.map((sku: any) => sku.product.fulfillmentType || 'delivery'));
      if (fulfillmentTypes.size !== 1) {
        throw new BadRequestException('组合套餐内商品必须使用相同履约方式');
      }
      const configured = new Set<string>();
      let originalTotal = 0;
      for (const item of bundleItems) {
        const skuId = String(item?.skuId || '');
        const quantity = Number(item?.quantity);
        if (!/^[1-9]\d*$/.test(skuId) || !skuIdStrings.has(skuId)) {
          throw new BadRequestException('组合套餐SKU必须来自当前活动商品');
        }
        if (configured.has(skuId)) throw new BadRequestException('组合套餐不能重复配置同一SKU');
        configured.add(skuId);
        if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 99) {
          throw new BadRequestException('组合套餐每个SKU数量必须为1-99的整数');
        }
        const sku: any = skuMap.get(skuId)!;
        originalTotal += sku.price * quantity;
        if ((activityStockBySku.get(skuId) || 0) < quantity) {
          throw new BadRequestException('套餐SKU活动库存不能小于单套所需数量');
        }
      }
      if (configured.size !== skuIdStrings.size) {
        throw new BadRequestException('组合套餐规则必须覆盖当前活动中的全部SKU');
      }
      if (bundlePrice > originalTotal) {
        throw new BadRequestException('组合套餐价不能高于套餐商品原价合计');
      }
    }
  }
}
