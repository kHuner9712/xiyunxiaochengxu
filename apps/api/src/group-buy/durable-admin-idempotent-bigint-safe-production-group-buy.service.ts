import { createHash } from 'node:crypto';
import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { PrismaService } from '../common/prisma/prisma.service';
import { BenefitPackageService } from '../benefit-package/benefit-package.service';
import { OrderService } from '../order/order.service';
import { PromotionCheckoutService } from '../order/promotion-checkout.service';
import {
  CreateGroupBuyActivityDto,
  GroupBuyActivityDto,
  GroupBuyActivityQueryDto,
  GroupBuyActivityStatusDto,
  GroupBuyGroupQueryDto,
  GroupBuyMemberQueryDto,
} from './dto/group-buy.dto';
import { IdempotentBigintSafeProductionGroupBuyService } from './idempotent-bigint-safe-production-group-buy.service';

const CREATE_EVENT_TYPE = 'group_buy_activity_create';
const CREATE_EVENT_BIZ_TYPE = 'group_buy_activity';
const SERIALIZABLE_RETRY_LIMIT = 3;

type DbClient = PrismaService | Prisma.TransactionClient;
type ActivityDefinition = {
  productId: string | bigint;
  skuId: string | bigint | null;
  groupPrice: number;
  startTime: string | Date;
  endTime: string | Date;
  status: number;
};

@Injectable()
export class DurableAdminIdempotentBigintSafeProductionGroupBuyService extends IdempotentBigintSafeProductionGroupBuyService {
  constructor(
    private readonly adminPrisma: PrismaService,
    @Inject(forwardRef(() => OrderService)) orderService: OrderService,
    promotionCheckout: PromotionCheckoutService,
    benefitPackageService: BenefitPackageService,
  ) {
    super(adminPrisma, orderService, promotionCheckout, benefitPackageService);
  }

  override async findActivities(query: GroupBuyActivityQueryDto) {
    if (query.productId) {
      query.productId = parsePositiveBigIntId(query.productId, '商品').toString();
    }
    return super.findActivities(query);
  }

  override async findActivityById(id: string) {
    const activityId = parsePositiveBigIntId(id, '拼团活动');
    const activity = await this.adminPrisma.groupBuyActivity.findFirst({
      where: { id: activityId, deletedAt: null },
    });
    if (!activity) throw new NotFoundException('拼团活动不存在');
    return activity;
  }

  override async createActivity(dto: GroupBuyActivityDto) {
    const createDto = dto as CreateGroupBuyActivityDto;
    const requestId = String(createDto.clientRequestId ?? '').trim() || null;
    const fingerprint = this.createFingerprint(dto);

    for (let attempt = 0; attempt < SERIALIZABLE_RETRY_LIMIT; attempt += 1) {
      try {
        return await this.adminPrisma.$transaction(
          async (tx) => {
            if (requestId) {
              const handled = await tx.businessEvent.findFirst({
                where: {
                  eventType: CREATE_EVENT_TYPE,
                  bizType: CREATE_EVENT_BIZ_TYPE,
                  bizId: requestId,
                },
                orderBy: { id: 'desc' },
              });
              if (handled) {
                const payload = this.readCreateEventPayload(handled.payload);
                if (payload.fingerprint !== fingerprint) {
                  throw new BadRequestException('拼团活动创建请求ID已被其他操作使用，请重新提交');
                }
                const replayId = parsePositiveBigIntId(payload.activityId, '拼团活动');
                const existing = await tx.groupBuyActivity.findUnique({ where: { id: replayId } });
                if (!existing || existing.deletedAt) {
                  throw new BadRequestException('该拼团活动创建请求已处理，但活动已不存在，请刷新列表');
                }
                return existing;
              }
            }

            const status = dto.status ?? 1;
            const definition = await this.assertActivityDefinition(tx, {
              ...dto,
              status,
            });
            const activity = await tx.groupBuyActivity.create({
              data: {
                name: dto.name,
                productId: definition.productId,
                skuId: definition.skuId,
                groupPrice: dto.groupPrice,
                originalPrice: dto.originalPrice ?? null,
                groupSize: dto.groupSize,
                groupExpireHours: dto.groupExpireHours ?? 24,
                stockLimit: dto.stockLimit ?? null,
                limitPerUser: dto.limitPerUser ?? 0,
                startTime: definition.startTime,
                endTime: definition.endTime,
                status,
                sortOrder: dto.sortOrder ?? 0,
                description: dto.description ?? null,
                coverImage: dto.coverImage ?? null,
              },
            });

            if (requestId) {
              await tx.businessEvent.create({
                data: {
                  eventType: CREATE_EVENT_TYPE,
                  bizType: CREATE_EVENT_BIZ_TYPE,
                  bizId: requestId,
                  level: 'info',
                  message: '拼团活动创建请求已处理',
                  payload: {
                    activityId: activity.id.toString(),
                    fingerprint,
                  } as Prisma.InputJsonValue,
                },
              });
            }
            return activity;
          },
          { isolationLevel: 'Serializable', timeout: 15_000 },
        );
      } catch (error: any) {
        if (error?.code === 'P2034' && attempt + 1 < SERIALIZABLE_RETRY_LIMIT) continue;
        throw error;
      }
    }

    throw new Error('拼团活动创建事务重试次数已耗尽');
  }

  override async updateActivity(id: string, dto: GroupBuyActivityDto) {
    const activityId = parsePositiveBigIntId(id, '拼团活动');
    return this.adminPrisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM group_buy_activities WHERE id = ${activityId} FOR UPDATE`;
      const current = await tx.groupBuyActivity.findUnique({ where: { id: activityId } });
      if (!current || current.deletedAt) throw new NotFoundException('拼团活动不存在');

      const status = dto.status ?? current.status;
      const definition = await this.assertActivityDefinition(tx, {
        ...dto,
        status,
      });
      return tx.groupBuyActivity.update({
        where: { id: activityId },
        data: {
          name: dto.name,
          productId: definition.productId,
          skuId: definition.skuId,
          groupPrice: dto.groupPrice,
          originalPrice: dto.originalPrice ?? null,
          groupSize: dto.groupSize,
          groupExpireHours: dto.groupExpireHours ?? 24,
          stockLimit: dto.stockLimit ?? null,
          limitPerUser: dto.limitPerUser ?? 0,
          startTime: definition.startTime,
          endTime: definition.endTime,
          status,
          sortOrder: dto.sortOrder ?? 0,
          description: dto.description ?? null,
          coverImage: dto.coverImage ?? null,
        },
      });
    });
  }

  override async updateActivityStatus(id: string, dto: GroupBuyActivityStatusDto) {
    const activityId = parsePositiveBigIntId(id, '拼团活动');
    return this.adminPrisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM group_buy_activities WHERE id = ${activityId} FOR UPDATE`;
      const current = await tx.groupBuyActivity.findUnique({ where: { id: activityId } });
      if (!current || current.deletedAt) throw new NotFoundException('拼团活动不存在');

      if (dto.status === 1) {
        await this.assertActivityDefinition(tx, {
          productId: current.productId,
          skuId: current.skuId,
          groupPrice: current.groupPrice,
          startTime: current.startTime,
          endTime: current.endTime,
          status: 1,
        });
      }
      return tx.groupBuyActivity.update({
        where: { id: activityId },
        data: { status: dto.status },
      });
    });
  }

  override async deleteActivity(id: string) {
    const activityId = parsePositiveBigIntId(id, '拼团活动');
    return this.adminPrisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM group_buy_activities WHERE id = ${activityId} FOR UPDATE`;
      const current = await tx.groupBuyActivity.findUnique({ where: { id: activityId } });
      if (!current) throw new NotFoundException('拼团活动不存在');
      if (current.deletedAt) return { success: true };
      await tx.groupBuyActivity.update({
        where: { id: activityId },
        data: { deletedAt: new Date(), status: 0 },
      });
      return { success: true };
    });
  }

  override async findGroups(query: GroupBuyGroupQueryDto) {
    if (query.activityId) query.activityId = parsePositiveBigIntId(query.activityId, '活动').toString();
    if (query.leaderUserId) query.leaderUserId = parsePositiveBigIntId(query.leaderUserId, '团长用户').toString();
    return super.findGroups(query);
  }

  override async findGroupById(id: string) {
    const groupId = parsePositiveBigIntId(id, '团');
    return super.findGroupById(groupId.toString());
  }

  override async findMembers(query: GroupBuyMemberQueryDto) {
    if (query.groupId) query.groupId = parsePositiveBigIntId(query.groupId, '团').toString();
    if (query.activityId) query.activityId = parsePositiveBigIntId(query.activityId, '活动').toString();
    if (query.userId) query.userId = parsePositiveBigIntId(query.userId, '用户').toString();
    if (query.orderId) query.orderId = parsePositiveBigIntId(query.orderId, '订单').toString();
    return super.findMembers(query);
  }

  private async assertActivityDefinition(client: DbClient, input: ActivityDefinition) {
    const productId = parsePositiveBigIntId(input.productId, '商品');
    if (!input.skuId) throw new BadRequestException('拼团活动必须配置SKU');
    const skuId = parsePositiveBigIntId(input.skuId, 'SKU ');
    const startTime = input.startTime instanceof Date ? input.startTime : new Date(input.startTime);
    const endTime = input.endTime instanceof Date ? input.endTime : new Date(input.endTime);
    if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
      throw new BadRequestException('开始/结束时间格式错误');
    }
    if (endTime <= startTime) throw new BadRequestException('结束时间必须晚于开始时间');
    if (input.status === 1 && endTime <= new Date()) {
      throw new BadRequestException('上架拼团活动的结束时间必须晚于当前时间');
    }

    const sku = await client.productSku.findFirst({
      where: { id: skuId, status: 1 },
      include: { product: true },
    });
    if (!sku || sku.product.status !== 1) {
      throw new BadRequestException('商品规格不存在或已下架');
    }
    if (sku.productId !== productId) throw new BadRequestException('SKU不属于所选商品');
    if (input.groupPrice > sku.price) throw new BadRequestException('拼团价不能高于当前SKU价格');
    if (sku.product.fulfillmentType !== 'delivery' && sku.product.fulfillmentType !== 'pickup') {
      throw new BadRequestException('拼团活动仅支持单一快递或单一自提商品');
    }

    return { productId, skuId, startTime, endTime };
  }

  private createFingerprint(dto: GroupBuyActivityDto) {
    const normalizeOptional = (value: unknown) => value === undefined || value === null || value === '' ? null : value;
    const normalized = {
      name: String(dto.name ?? '').trim(),
      productId: String(dto.productId ?? '').trim(),
      skuId: String(dto.skuId ?? '').trim(),
      groupPrice: Number(dto.groupPrice),
      originalPrice: normalizeOptional(dto.originalPrice) === null ? null : Number(dto.originalPrice),
      groupSize: Number(dto.groupSize),
      groupExpireHours: dto.groupExpireHours ?? 24,
      stockLimit: normalizeOptional(dto.stockLimit) === null ? null : Number(dto.stockLimit),
      limitPerUser: dto.limitPerUser ?? 0,
      startTime: new Date(dto.startTime).toISOString(),
      endTime: new Date(dto.endTime).toISOString(),
      status: dto.status ?? 1,
      sortOrder: dto.sortOrder ?? 0,
      description: normalizeOptional(dto.description),
      coverImage: normalizeOptional(dto.coverImage),
    };
    return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
  }

  private readCreateEventPayload(payload: unknown) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new BadRequestException('拼团活动创建幂等记录损坏，请刷新列表后重试');
    }
    const record = payload as Record<string, unknown>;
    const activityId = String(record.activityId ?? '').trim();
    const fingerprint = String(record.fingerprint ?? '').trim();
    if (!activityId || !fingerprint) {
      throw new BadRequestException('拼团活动创建幂等记录损坏，请刷新列表后重试');
    }
    return { activityId, fingerprint };
  }
}
