import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { SystemConfigService } from '../system-config/system-config.service';
import { ActivityMultiItemCheckoutService } from './activity-multi-item-checkout.service';
import { ActivityCheckoutDto } from './dto/activity-checkout.dto';

const ACTIVITY_CHECKOUT_LOCK_TTL_SECONDS = 30;

type FullGiftRule = {
  fullAmount: number;
  giftSkuId: string;
  giftQuantity: number;
};

type QuotaState = {
  skuId: string;
  stock: number;
  remainingActivity: number;
  remainingUser: number;
};

type FullGiftContext = {
  anchorSkuId: string;
  anchorPrice: number;
  rules: FullGiftRule[];
  quotaBySku: Map<string, QuotaState>;
};

/**
 * Adds the one piece of quota accounting that cannot be expressed by the base multi-item
 * checkout's per-line checks: a full-gift rule is allowed to give the same SKU that the user is
 * buying. In that case paid quantity + gift quantity must be checked as one aggregate claim.
 *
 * The Redis lock covers the pre-check and the base service's database transaction. The base
 * transaction already row-locks the activity before its normal quota checks; the extra lock makes
 * this aggregate same-SKU check race-safe without banning the legitimate “买同款赠同款” use case.
 */
@Injectable()
export class QuotaSafeActivityMultiItemCheckoutService extends ActivityMultiItemCheckoutService {
  private readonly logger = new Logger(QuotaSafeActivityMultiItemCheckoutService.name);

  constructor(
    private readonly quotaPrisma: PrismaService,
    private readonly quotaRedis: RedisService,
    systemConfigService: SystemConfigService,
  ) {
    super(quotaPrisma, systemConfigService);
  }

  override async preview(
    userId: bigint,
    activityId: bigint,
    anchorActivityProductId: bigint,
    anchorSkuId: bigint,
    dto: ActivityCheckoutDto,
  ) {
    const result = await super.preview(
      userId,
      activityId,
      anchorActivityProductId,
      anchorSkuId,
      dto,
    );
    const context = await this.loadFullGiftContext(
      userId,
      activityId,
      anchorActivityProductId,
      anchorSkuId,
    );
    if (!context) return result;

    const aggregateMax = this.resolveAggregateMaxQuantity(context);
    return {
      ...result,
      maxQuantity: Math.min(Number(result.maxQuantity ?? 99), aggregateMax),
    };
  }

  override async createOrder(
    userId: bigint,
    activityId: bigint,
    anchorActivityProductId: bigint,
    anchorSkuId: bigint,
    dto: ActivityCheckoutDto,
  ) {
    const lockKey = `activity:multi-checkout:${activityId}`;
    const lockValue = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const acquired = await this.quotaRedis.setNX(
      lockKey,
      lockValue,
      ACTIVITY_CHECKOUT_LOCK_TTL_SECONDS,
    );
    if (!acquired) {
      throw new BadRequestException('活动库存正在结算，请稍后重试');
    }

    try {
      const context = await this.loadFullGiftContext(
        userId,
        activityId,
        anchorActivityProductId,
        anchorSkuId,
      );
      if (context && !this.isQuantityFeasible(context, dto.quantity)) {
        throw new BadRequestException('活动库存或限购不足，当前数量无法完成满赠');
      }
      return await super.createOrder(
        userId,
        activityId,
        anchorActivityProductId,
        anchorSkuId,
        dto,
      );
    } finally {
      try {
        await this.quotaRedis.releaseLockWithLua(lockKey, lockValue);
      } catch (error: any) {
        // The order may already have committed. Never turn a successful order into a client-visible
        // failure because lock cleanup failed; the lock has a short TTL and will self-expire.
        this.logger.warn(
          `活动结算锁释放失败: activityId=${activityId}, error=${error?.message || error}`,
        );
      }
    }
  }

  private async loadFullGiftContext(
    userId: bigint,
    activityId: bigint,
    anchorActivityProductId: bigint,
    anchorSkuId: bigint,
  ): Promise<FullGiftContext | null> {
    const activity = await this.quotaPrisma.activity.findUnique({
      where: { id: activityId },
      select: { type: true, rules: true },
    });
    if (!activity || String(activity.type) !== '3') return null;

    const relations = await this.quotaPrisma.activityProduct.findMany({
      where: { activityId },
      select: {
        id: true,
        skuId: true,
        activityStock: true,
        limitPerUser: true,
      },
    });
    const anchor = relations.find((relation) => relation.id === anchorActivityProductId);
    if (!anchor?.skuId || anchor.skuId !== anchorSkuId) {
      throw new BadRequestException('所选SKU不属于该满赠活动');
    }

    const rules = this.normalizeFullGiftRules(activity.rules);
    if (rules.length === 0) return null;

    const skuIds = Array.from(new Set(
      relations
        .map((relation) => relation.skuId)
        .filter((skuId): skuId is bigint => Boolean(skuId)),
    ));
    const skus = await this.quotaPrisma.productSku.findMany({
      where: { id: { in: skuIds }, status: 1 },
      select: { id: true, price: true, stock: true },
    });
    const skuMap = new Map(skus.map((sku) => [sku.id.toString(), sku]));
    const anchorSku = skuMap.get(anchorSkuId.toString());
    if (!anchorSku) throw new BadRequestException('满赠主商品SKU不存在或已下架');

    const quotaBySku = new Map<string, QuotaState>();
    for (const relation of relations) {
      if (!relation.skuId) continue;
      const skuId = relation.skuId.toString();
      const sku = skuMap.get(skuId);
      if (!sku) continue;

      const [soldRows, userRows] = await Promise.all([
        this.quotaPrisma.$queryRaw<Array<{ quantity: bigint | number | string }>>`
          SELECT COALESCE(SUM(oi.quantity), 0) AS quantity
          FROM order_items oi
          INNER JOIN orders o ON o.id = oi.order_id
          WHERE oi.activity_id = ${activityId}
            AND oi.activity_type = 'activity'
            AND oi.sku_id = ${relation.skuId}
            AND o.status <> 'cancelled'
        `,
        this.quotaPrisma.$queryRaw<Array<{ quantity: bigint | number | string }>>`
          SELECT COALESCE(SUM(oi.quantity), 0) AS quantity
          FROM order_items oi
          INNER JOIN orders o ON o.id = oi.order_id
          WHERE oi.activity_id = ${activityId}
            AND oi.activity_type = 'activity'
            AND oi.sku_id = ${relation.skuId}
            AND o.user_id = ${userId}
            AND o.status <> 'cancelled'
        `,
      ]);
      const sold = Number(soldRows[0]?.quantity ?? 0);
      const boughtByUser = Number(userRows[0]?.quantity ?? 0);
      const activityStock = Number(relation.activityStock ?? 0);
      const limitPerUser = Number(relation.limitPerUser ?? 0);
      if (
        !Number.isSafeInteger(sold) || sold < 0 ||
        !Number.isSafeInteger(boughtByUser) || boughtByUser < 0 ||
        !Number.isSafeInteger(activityStock) || activityStock < 0 ||
        !Number.isSafeInteger(limitPerUser) || limitPerUser < 0
      ) {
        throw new BadRequestException('满赠活动配额状态异常，请稍后重试');
      }
      quotaBySku.set(skuId, {
        skuId,
        stock: Math.max(0, Number(sku.stock ?? 0)),
        remainingActivity: Math.max(0, activityStock - sold),
        remainingUser: limitPerUser > 0
          ? Math.max(0, limitPerUser - boughtByUser)
          : Number.MAX_SAFE_INTEGER,
      });
    }

    return {
      anchorSkuId: anchorSkuId.toString(),
      anchorPrice: anchorSku.price,
      rules,
      quotaBySku,
    };
  }

  private normalizeFullGiftRules(rawRules: unknown): FullGiftRule[] {
    let rules: any = rawRules || {};
    if (typeof rules === 'string') {
      try {
        rules = JSON.parse(rules);
      } catch {
        throw new BadRequestException('满赠活动规则配置损坏');
      }
    }
    const entries = Array.isArray(rules?.fullGiftRules) ? rules.fullGiftRules : [];
    return entries
      .map((rule: any) => ({
        fullAmount: Number(rule?.fullAmount),
        giftSkuId: String(rule?.giftSkuId || ''),
        giftQuantity: Number(rule?.giftQuantity),
      }))
      .filter((rule: FullGiftRule) =>
        Number.isSafeInteger(rule.fullAmount) && rule.fullAmount > 0 &&
        /^[1-9]\d*$/.test(rule.giftSkuId) &&
        Number.isSafeInteger(rule.giftQuantity) && rule.giftQuantity > 0 && rule.giftQuantity <= 99,
      )
      .sort((a: FullGiftRule, b: FullGiftRule) => b.fullAmount - a.fullAmount);
  }

  private resolveAggregateMaxQuantity(context: FullGiftContext) {
    let max = 0;
    for (let quantity = 1; quantity <= 99; quantity += 1) {
      if (this.isQuantityFeasible(context, quantity)) max = quantity;
    }
    return max;
  }

  private isQuantityFeasible(context: FullGiftContext, quantity: number) {
    if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 99) return false;

    const requiredBySku = new Map<string, number>([[context.anchorSkuId, quantity]]);
    const paidAmount = context.anchorPrice * quantity;
    const matched = context.rules.find((rule) => paidAmount >= rule.fullAmount);
    if (matched) {
      requiredBySku.set(
        matched.giftSkuId,
        (requiredBySku.get(matched.giftSkuId) || 0) + matched.giftQuantity,
      );
    }

    for (const [skuId, required] of requiredBySku) {
      const quota = context.quotaBySku.get(skuId);
      if (!quota) return false;
      if (
        required > quota.stock ||
        required > quota.remainingActivity ||
        required > quota.remainingUser
      ) {
        return false;
      }
    }
    return true;
  }
}
