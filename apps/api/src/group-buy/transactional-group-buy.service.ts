import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { BenefitPackageService } from '../benefit-package/benefit-package.service';
import { OrderService } from '../order/order.service';
import { PromotionCheckoutService } from '../order/promotion-checkout.service';
import {
  GroupBuyActivityDto,
  JoinGroupBuyDto,
  StartGroupBuyDto,
} from './dto/group-buy.dto';
import { GroupBuyService } from './group-buy.service';

function generateGroupNo(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.floor(Math.random() * 1_000_000)
    .toString(36)
    .toUpperCase()
    .padStart(4, '0');
  return `GB${timestamp}${random}`.slice(0, 32);
}

type GroupBuyPaymentState =
  | 'waiting'
  | 'success'
  | 'refund_required'
  | 'already_refunded';

interface GroupBuyPaymentOutcome {
  isGroupBuy: true;
  state: GroupBuyPaymentState;
  releasedOrderIds?: string[];
  reason?: string;
}

@Injectable()
export class TransactionalGroupBuyService extends GroupBuyService {
  private readonly transactionalLogger = new Logger(
    TransactionalGroupBuyService.name,
  );

  constructor(
    private readonly transactionalPrisma: PrismaService,
    @Inject(forwardRef(() => OrderService))
    private readonly transactionalOrderService: OrderService,
    private readonly promotionCheckout: PromotionCheckoutService,
    private readonly benefitPackageService: BenefitPackageService,
  ) {
    super(transactionalPrisma, transactionalOrderService);
  }

  override async createActivity(dto: GroupBuyActivityDto) {
    await this.assertActivityProductSku(dto);
    return super.createActivity(dto);
  }

  override async updateActivity(id: string, dto: GroupBuyActivityDto) {
    parsePositiveBigIntId(id, '活动');
    await this.assertActivityProductSku(dto);
    return super.updateActivity(id, dto);
  }

  override async weappFindActivityById(id: string) {
    const activityId = parsePositiveBigIntId(id, '活动');
    const activity = await this.transactionalPrisma.groupBuyActivity.findFirst({
      where: { id: activityId, deletedAt: null },
    });
    if (!activity) throw new NotFoundException('拼团活动不存在');
    return activity;
  }

  override async startGroupBuy(userId: string, dto: StartGroupBuyDto) {
    const quantity = this.assertSupportedQuantity(dto.quantity);
    const userIdValue = parsePositiveBigIntId(userId, '用户');
    const activityId = parsePositiveBigIntId(dto.activityId, '活动');

    const result = await this.transactionalPrisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`
          SELECT id FROM group_buy_activities
          WHERE id = ${activityId}
          FOR UPDATE
        `;

        const activity = await tx.groupBuyActivity.findFirst({
          where: { id: activityId, deletedAt: null },
        });
        this.assertTransactionalActivityValid(activity);
        await this.assertActivityCapacity(tx, activity!, userIdValue, quantity);

        const skuId = activity!.skuId ??
          (dto.skuId ? parsePositiveBigIntId(dto.skuId, 'SKU ') : null);
        if (!skuId) throw new BadRequestException('该活动未配置商品规格');
        if (activity!.skuId && skuId !== activity!.skuId) {
          throw new BadRequestException('所选规格不属于该拼团活动');
        }
        await this.assertSkuMatchesActivity(tx, activity!.productId, skuId, activity!.groupPrice);

        const now = new Date();
        const expiresAt = new Date(
          now.getTime() + activity!.groupExpireHours * 3_600_000,
        );
        const group = await tx.groupBuyGroup.create({
          data: {
            activityId: activity!.id,
            leaderUserId: userIdValue,
            status: 'forming',
            groupNo: generateGroupNo(),
            currentCount: 0,
            targetCount: activity!.groupSize,
            expiresAt,
          },
        });

        const order = await this.promotionCheckout.createOrder(tx, {
          userId: userIdValue,
          skuId,
          quantity,
          unitPrice: activity!.groupPrice,
          activityId: activity!.id,
          activityType: 'group_buy',
          addressId: dto.addressId,
          pickupStoreId: dto.pickupStoreId,
          fulfillmentType: dto.fulfillmentType,
          remark: dto.remark,
          sourceType: 'direct',
          holdUntilPromotionSuccess: true,
        });

        const member = await tx.groupBuyMember.create({
          data: {
            groupId: group.id,
            activityId: activity!.id,
            userId: userIdValue,
            orderId: order.orderId,
            orderItemId: order.orderItemId,
            role: 'leader',
            status: order.isZeroPay ? 'paid' : 'pending_payment',
            ...(order.isZeroPay ? { paidAt: now } : {}),
          },
        });

        let zeroPayOutcome: GroupBuyPaymentOutcome | null = null;
        if (order.isZeroPay) {
          zeroPayOutcome = await this.settlePaidMemberInTransaction(
            tx,
            member.id,
            now,
            true,
          );
        }

        return {
          response: {
            groupId: group.id.toString(),
            groupNo: group.groupNo,
            orderId: order.orderId.toString(),
            role: 'leader',
          },
          zeroPayOutcome,
        };
      },
      { timeout: 15_000 },
    );

    await this.processZeroPayOutcome(result.zeroPayOutcome);
    return result.response;
  }

  override async joinGroupBuy(userId: string, dto: JoinGroupBuyDto) {
    const quantity = this.assertSupportedQuantity(dto.quantity);
    const userIdValue = parsePositiveBigIntId(userId, '用户');
    const groupId = parsePositiveBigIntId(dto.groupId, '团');

    const result = await this.transactionalPrisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`
          SELECT id FROM group_buy_groups
          WHERE id = ${groupId}
          FOR UPDATE
        `;

        const group = await tx.groupBuyGroup.findFirst({
          where: { id: groupId, deletedAt: null },
        });
        if (!group) throw new NotFoundException('团单不存在');
        if (group.status !== 'forming') {
          throw new BadRequestException('该团已不可加入');
        }
        if (group.expiresAt <= new Date()) {
          throw new BadRequestException('该团已过期');
        }

        const activeMemberCount = await tx.groupBuyMember.count({
          where: {
            groupId: group.id,
            deletedAt: null,
            status: { in: ['pending_payment', 'paid'] },
          },
        });
        if (activeMemberCount >= group.targetCount) {
          throw new BadRequestException('该团已满');
        }

        await tx.$queryRaw`
          SELECT id FROM group_buy_activities
          WHERE id = ${group.activityId}
          FOR UPDATE
        `;
        const activity = await tx.groupBuyActivity.findFirst({
          where: { id: group.activityId, deletedAt: null },
        });
        this.assertTransactionalActivityValid(activity);
        await this.assertActivityCapacity(tx, activity!, userIdValue, quantity);

        const existed = await tx.groupBuyMember.findFirst({
          where: {
            groupId: group.id,
            userId: userIdValue,
            deletedAt: null,
          },
          select: { id: true },
        });
        if (existed) throw new BadRequestException('你已加入该团');
        if (!activity!.skuId) {
          throw new BadRequestException('活动未配置商品规格，无法参团');
        }
        await this.assertSkuMatchesActivity(
          tx,
          activity!.productId,
          activity!.skuId,
          activity!.groupPrice,
        );

        const order = await this.promotionCheckout.createOrder(tx, {
          userId: userIdValue,
          skuId: activity!.skuId,
          quantity,
          unitPrice: activity!.groupPrice,
          activityId: activity!.id,
          activityType: 'group_buy',
          addressId: dto.addressId,
          pickupStoreId: dto.pickupStoreId,
          fulfillmentType: dto.fulfillmentType,
          remark: dto.remark,
          sourceType: 'direct',
          holdUntilPromotionSuccess: true,
        });

        const now = new Date();
        const member = await tx.groupBuyMember.create({
          data: {
            groupId: group.id,
            activityId: activity!.id,
            userId: userIdValue,
            orderId: order.orderId,
            orderItemId: order.orderItemId,
            role: 'member',
            status: order.isZeroPay ? 'paid' : 'pending_payment',
            ...(order.isZeroPay ? { paidAt: now } : {}),
          },
        });

        let zeroPayOutcome: GroupBuyPaymentOutcome | null = null;
        if (order.isZeroPay) {
          zeroPayOutcome = await this.settlePaidMemberInTransaction(
            tx,
            member.id,
            now,
            true,
          );
        }

        return {
          response: {
            groupId: group.id.toString(),
            groupNo: group.groupNo,
            orderId: order.orderId.toString(),
            role: 'member',
          },
          zeroPayOutcome,
        };
      },
      { timeout: 15_000 },
    );

    await this.processZeroPayOutcome(result.zeroPayOutcome);
    return result.response;
  }

  override async weappFindAvailableGroups(activityId: string) {
    const activityIdValue = parsePositiveBigIntId(activityId, '活动');
    const activity = await this.transactionalPrisma.groupBuyActivity.findFirst({
      where: { id: activityIdValue, deletedAt: null },
    });
    this.assertTransactionalActivityValid(activity);

    const now = new Date();
    const groups = await this.transactionalPrisma.groupBuyGroup.findMany({
      where: {
        activityId: activity!.id,
        status: 'forming',
        expiresAt: { gt: now },
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });

    const groupIds = groups.map((group) => group.id);
    const members = groupIds.length
      ? await this.transactionalPrisma.groupBuyMember.findMany({
          where: {
            groupId: { in: groupIds },
            deletedAt: null,
            status: { in: ['pending_payment', 'paid'] },
          },
          select: {
            id: true,
            groupId: true,
            userId: true,
            role: true,
            status: true,
            paidAt: true,
          },
        })
      : [];

    const memberMap = new Map<string, typeof members>();
    for (const member of members) {
      const key = member.groupId.toString();
      const groupMembers = memberMap.get(key) ?? [];
      groupMembers.push(member);
      memberMap.set(key, groupMembers);
    }

    const leaderIds = Array.from(
      new Set(groups.map((group) => group.leaderUserId.toString())),
    ).map((id) => BigInt(id));
    const leaders = leaderIds.length
      ? await this.transactionalPrisma.user.findMany({
          where: { id: { in: leaderIds } },
          select: { id: true, nickname: true, avatarUrl: true },
        })
      : [];
    const leaderMap = new Map(
      leaders.map((leader) => [leader.id.toString(), leader]),
    );

    return groups.map((group) => ({
      ...group,
      members: memberMap.get(group.id.toString()) ?? [],
      leader: leaderMap.get(group.leaderUserId.toString()) ?? null,
    }));
  }

  override async handlePaymentSuccess(
    orderId: bigint | string,
  ): Promise<any> {
    const orderIdValue = parsePositiveBigIntId(orderId, '订单');
    const member = await this.transactionalPrisma.groupBuyMember.findFirst({
      where: { orderId: orderIdValue, deletedAt: null },
      select: { id: true },
    });
    if (!member) return { isGroupBuy: false };

    return this.transactionalPrisma.$transaction(
      async (tx) => this.settlePaidMemberInTransaction(tx, member.id, new Date(), false),
      { timeout: 15_000 },
    );
  }

  override async handleOrderCancel(orderId: bigint | string): Promise<void> {
    const orderIdValue = parsePositiveBigIntId(orderId, '订单');
    const member = await this.transactionalPrisma.groupBuyMember.findFirst({
      where: { orderId: orderIdValue, deletedAt: null },
    });
    if (!member) return;
    if (member.status === 'cancelled' || member.status === 'refunded') return;
    if (member.status === 'paid') {
      this.transactionalLogger.warn(
        `已付款拼团成员不能按未支付订单取消: orderId=${orderId}`,
      );
      return;
    }
    await this.transactionalPrisma.groupBuyMember.updateMany({
      where: { id: member.id, status: 'pending_payment' },
      data: { status: 'cancelled' },
    });
  }

  override async markExpiredGroups(): Promise<any> {
    const now = new Date();
    const candidates = await this.transactionalPrisma.groupBuyGroup.findMany({
      where: {
        status: 'forming',
        expiresAt: { lte: now },
        deletedAt: null,
      },
      select: { id: true },
      orderBy: { expiresAt: 'asc' },
      take: 100,
    });

    let affected = 0;
    const refundOrderIds: string[] = [];
    for (const candidate of candidates) {
      const outcome = await this.transactionalPrisma.$transaction(async (tx) => {
        await tx.$queryRaw`
          SELECT id FROM group_buy_groups
          WHERE id = ${candidate.id}
          FOR UPDATE
        `;
        const group = await tx.groupBuyGroup.findFirst({
          where: { id: candidate.id, deletedAt: null },
        });
        if (!group || group.status !== 'forming' || group.expiresAt > now) {
          return { changed: false, paidOrders: [] as string[] };
        }

        const changed = await tx.groupBuyGroup.updateMany({
          where: { id: group.id, status: 'forming' },
          data: { status: 'failed', failedAt: now },
        });
        if (changed.count === 0) {
          return { changed: false, paidOrders: [] as string[] };
        }

        const paidMembers = await tx.groupBuyMember.findMany({
          where: { groupId: group.id, status: 'paid', deletedAt: null },
          select: { orderId: true },
        });
        return {
          changed: true,
          paidOrders: paidMembers.map((member) => member.orderId.toString()),
        };
      });

      if (outcome.changed) {
        affected += 1;
        refundOrderIds.push(...outcome.paidOrders);
      }
    }

    if (affected > 0) {
      this.transactionalLogger.log(
        `拼团过期处理完成: failedGroups=${affected}, refundOrders=${refundOrderIds.length}`,
      );
    }
    return { affected, refundOrderIds };
  }

  async handleRefundSuccess(orderId: bigint | string): Promise<void> {
    const orderIdValue = parsePositiveBigIntId(orderId, '订单');
    await this.transactionalPrisma.$transaction(async (tx) => {
      const member = await tx.groupBuyMember.findFirst({
        where: { orderId: orderIdValue, deletedAt: null },
      });
      if (!member) return;

      await tx.$queryRaw`
        SELECT id FROM group_buy_groups
        WHERE id = ${member.groupId}
        FOR UPDATE
      `;
      const group = await tx.groupBuyGroup.findFirst({
        where: { id: member.groupId, deletedAt: null },
      });
      if (!group || (group.status !== 'failed' && group.status !== 'cancelled')) {
        return;
      }

      const claim = await tx.groupBuyMember.updateMany({
        where: { id: member.id, status: 'paid' },
        data: { status: 'refunded' },
      });

      const order = await tx.order.findUnique({
        where: { id: orderIdValue },
        include: { orderItems: true },
      });
      if (!order) return;

      if (claim.count > 0) {
        for (const item of order.orderItems) {
          const sku = await tx.productSku.findUnique({
            where: { id: item.skuId },
            select: { stock: true },
          });
          if (!sku) continue;
          await tx.$executeRaw`
            UPDATE product_skus
            SET stock = stock + ${item.quantity},
                sales = GREATEST(sales - ${item.quantity}, 0),
                updated_at = NOW(3)
            WHERE id = ${item.skuId}
          `;
          await tx.productStockLog.create({
            data: {
              productId: item.productId,
              skuId: item.skuId,
              type: 4,
              quantity: item.quantity,
              beforeStock: sku.stock,
              afterStock: sku.stock + item.quantity,
              reason: '拼团失败退款归还库存',
            },
          });
        }
      }

      if (order.status !== OrderStatus.cancelled) {
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: OrderStatus.cancelled,
            cancelledAt: new Date(),
            cancelReason: '拼团失败已退款',
          },
        });
        await tx.orderLog.create({
          data: {
            orderId: order.id,
            operatorType: 'system',
            action: 'group_buy_refund_success',
            content: '拼团失败退款成功，订单已关闭并归还库存',
          },
        });
      }
    });
  }

  private async settlePaidMemberInTransaction(
    tx: Prisma.TransactionClient,
    memberId: bigint,
    now: Date,
    memberAlreadyPaid: boolean,
  ): Promise<GroupBuyPaymentOutcome> {
    const member = await tx.groupBuyMember.findFirst({
      where: { id: memberId, deletedAt: null },
    });
    if (!member) throw new NotFoundException('拼团成员不存在');

    await tx.$queryRaw`
      SELECT id FROM group_buy_groups
      WHERE id = ${member.groupId}
      FOR UPDATE
    `;
    const group = await tx.groupBuyGroup.findFirst({
      where: { id: member.groupId, deletedAt: null },
    });
    if (!group) throw new NotFoundException('团单不存在');

    if (member.status === 'refunded') {
      return { isGroupBuy: true, state: 'already_refunded' };
    }
    if (member.status === 'cancelled') {
      return {
        isGroupBuy: true,
        state: 'refund_required',
        reason: '拼团成员已取消但支付成功，系统自动退款',
      };
    }

    let newlyCounted = false;
    if (member.status === 'pending_payment') {
      const claimed = await tx.groupBuyMember.updateMany({
        where: { id: member.id, status: 'pending_payment' },
        data: { status: 'paid', paidAt: now },
      });
      newlyCounted = claimed.count > 0;
    } else if (member.status === 'paid') {
      newlyCounted = memberAlreadyPaid;
    }

    if (group.status === 'failed' || group.status === 'cancelled') {
      return {
        isGroupBuy: true,
        state: 'refund_required',
        reason: '拼团失败自动退款',
      };
    }

    if (group.status === 'forming' && group.expiresAt <= now) {
      await tx.groupBuyGroup.updateMany({
        where: { id: group.id, status: 'forming' },
        data: { status: 'failed', failedAt: now },
      });
      return {
        isGroupBuy: true,
        state: 'refund_required',
        reason: '拼团已过期自动退款',
      };
    }

    let currentGroup = group;
    if (group.status === 'forming' && newlyCounted) {
      currentGroup = await tx.groupBuyGroup.update({
        where: { id: group.id },
        data: { currentCount: { increment: 1 } },
      });
    }

    let becameSuccessful = false;
    if (
      currentGroup.status === 'forming' &&
      currentGroup.currentCount >= currentGroup.targetCount
    ) {
      const success = await tx.groupBuyGroup.updateMany({
        where: { id: currentGroup.id, status: 'forming' },
        data: { status: 'success', successAt: now },
      });
      becameSuccessful = success.count > 0;
      if (becameSuccessful) {
        await tx.groupBuyActivity.update({
          where: { id: currentGroup.activityId },
          data: { soldCount: { increment: currentGroup.targetCount } },
        });
      }
      currentGroup = (await tx.groupBuyGroup.findUnique({
        where: { id: currentGroup.id },
      }))!;
    }

    if (currentGroup.status !== 'success') {
      return { isGroupBuy: true, state: 'waiting' };
    }

    const paidMembers = await tx.groupBuyMember.findMany({
      where: {
        groupId: currentGroup.id,
        status: 'paid',
        deletedAt: null,
      },
      select: { orderId: true },
    });
    const releasedOrderIds: string[] = [];
    for (const paidMember of paidMembers) {
      const paidOrder = await tx.order.findUnique({
        where: { id: paidMember.orderId },
        select: { id: true, status: true, fulfillmentType: true },
      });
      if (!paidOrder) continue;

      const targetStatus = paidOrder.fulfillmentType === 'pickup'
        ? OrderStatus.pending_pickup
        : OrderStatus.pending_delivery;
      if (paidOrder.status === OrderStatus.paid) {
        await tx.order.update({
          where: { id: paidOrder.id },
          data: { status: targetStatus },
        });
        if (targetStatus === OrderStatus.pending_pickup) {
          await this.transactionalOrderService.assignUniquePickupCode(
            tx,
            paidOrder.id,
          );
        }
        await tx.orderLog.create({
          data: {
            orderId: paidOrder.id,
            operatorType: 'system',
            action: 'group_buy_success',
            content: `拼团成功，订单进入${targetStatus === OrderStatus.pending_pickup ? '待自提' : '待发货'}`,
          },
        });
      }
      releasedOrderIds.push(paidOrder.id.toString());
    }

    if (becameSuccessful) {
      this.transactionalLogger.log(
        `拼团成功: groupId=${currentGroup.id}, releasedOrders=${releasedOrderIds.length}`,
      );
    }
    return { isGroupBuy: true, state: 'success', releasedOrderIds };
  }

  private async processZeroPayOutcome(
    outcome: GroupBuyPaymentOutcome | null,
  ): Promise<void> {
    if (!outcome) return;
    if (outcome.state === 'refund_required') {
      return;
    }
    if (outcome.state !== 'success' || !outcome.releasedOrderIds?.length) {
      return;
    }
    for (const orderId of outcome.releasedOrderIds) {
      const order = await this.transactionalPrisma.order.findUnique({
        where: { id: BigInt(orderId) },
        select: { id: true, userId: true, payAmount: true },
      });
      if (!order || (order.payAmount ?? 0) !== 0) continue;
      try {
        await this.benefitPackageService.grantBenefitsForOrder(order.id, order.userId);
      } catch (error) {
        this.transactionalLogger.error(
          `零元拼团权益发放失败: orderId=${order.id}`,
          (error as Error).message,
        );
      }
    }
  }

  private assertSupportedQuantity(quantityInput?: number): number {
    const quantity = quantityInput ?? 1;
    if (!Number.isInteger(quantity) || quantity !== 1) {
      throw new BadRequestException('拼团当前仅支持每人每次购买1件');
    }
    return quantity;
  }

  private assertTransactionalActivityValid(activity: {
    status: number;
    startTime: Date;
    endTime: Date;
  } | null): void {
    if (!activity) throw new NotFoundException('拼团活动不存在');
    if (activity.status !== 1) {
      throw new BadRequestException('活动已下架');
    }
    const now = new Date();
    if (now < activity.startTime) {
      throw new BadRequestException('活动未开始');
    }
    if (now >= activity.endTime) {
      throw new BadRequestException('活动已结束');
    }
  }

  private async assertActivityCapacity(
    tx: Prisma.TransactionClient,
    activity: {
      id: bigint;
      stockLimit: number | null;
      limitPerUser: number;
    },
    userId: bigint,
    quantity: number,
  ): Promise<void> {
    const [reservedCount, userCount] = await Promise.all([
      tx.groupBuyMember.count({
        where: {
          activityId: activity.id,
          deletedAt: null,
          status: { in: ['pending_payment', 'paid'] },
        },
      }),
      activity.limitPerUser > 0
        ? tx.groupBuyMember.count({
            where: {
              activityId: activity.id,
              userId,
              deletedAt: null,
              status: { in: ['pending_payment', 'paid'] },
            },
          })
        : Promise.resolve(0),
    ]);

    if (
      activity.stockLimit !== null &&
      reservedCount + quantity > activity.stockLimit
    ) {
      throw new BadRequestException('活动库存不足');
    }
    if (
      activity.limitPerUser > 0 &&
      userCount + quantity > activity.limitPerUser
    ) {
      throw new BadRequestException(
        `超过每人限购${activity.limitPerUser}次`,
      );
    }
  }

  private async assertActivityProductSku(dto: GroupBuyActivityDto): Promise<void> {
    const productId = parsePositiveBigIntId(dto.productId, '商品');
    const skuId = parsePositiveBigIntId(dto.skuId, 'SKU ');
    const sku = await this.transactionalPrisma.productSku.findFirst({
      where: { id: skuId, status: 1 },
      include: { product: true },
    });
    if (!sku || sku.product.status !== 1) {
      throw new BadRequestException('商品规格不存在或已下架');
    }
    if (sku.productId !== productId) {
      throw new BadRequestException('SKU不属于所选商品');
    }
    if (dto.groupPrice > sku.price) {
      throw new BadRequestException('拼团价不能高于当前SKU价格');
    }
  }

  private async assertSkuMatchesActivity(
    tx: Prisma.TransactionClient,
    productId: bigint,
    skuId: bigint,
    activityPrice: number,
  ): Promise<void> {
    const sku = await tx.productSku.findFirst({
      where: { id: skuId, status: 1 },
      include: { product: true },
    });
    if (!sku || sku.product.status !== 1) {
      throw new BadRequestException('活动商品规格不存在或已下架');
    }
    if (sku.productId !== productId) {
      throw new BadRequestException('活动SKU与商品不匹配');
    }
    if (activityPrice > sku.price) {
      throw new BadRequestException('活动价格不能高于当前SKU价格');
    }
  }
}
