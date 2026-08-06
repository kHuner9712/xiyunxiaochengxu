import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { OrderService } from '../order/order.service';
import { PromotionCheckoutService } from '../order/promotion-checkout.service';
import {
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

@Injectable()
export class TransactionalGroupBuyService extends GroupBuyService {
  constructor(
    private readonly transactionalPrisma: PrismaService,
    orderService: OrderService,
    private readonly promotionCheckout: PromotionCheckoutService,
  ) {
    super(transactionalPrisma, orderService);
  }

  override async startGroupBuy(userId: string, dto: StartGroupBuyDto) {
    const quantity = this.assertSupportedQuantity(dto.quantity);
    const userIdValue = BigInt(userId);
    const activityId = BigInt(dto.activityId);

    return this.transactionalPrisma.$transaction(
      async (tx) => {
        const activity = await tx.groupBuyActivity.findFirst({
          where: { id: activityId, deletedAt: null },
        });
        this.assertActivityValid(activity);
        await this.assertActivityCapacity(tx, activity!, userIdValue, quantity);

        const skuId = activity!.skuId ?? (dto.skuId ? BigInt(dto.skuId) : null);
        if (!skuId) throw new BadRequestException('请选择商品规格');
        if (activity!.skuId && skuId !== activity!.skuId) {
          throw new BadRequestException('所选规格不属于该拼团活动');
        }

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
        });

        const memberStatus = order.isZeroPay ? 'paid' : 'pending_payment';
        await tx.groupBuyMember.create({
          data: {
            groupId: group.id,
            activityId: activity!.id,
            userId: userIdValue,
            orderId: order.orderId,
            orderItemId: order.orderItemId,
            role: 'leader',
            status: memberStatus,
            ...(order.isZeroPay ? { paidAt: now } : {}),
          },
        });

        if (order.isZeroPay) {
          const updatedGroup = await tx.groupBuyGroup.update({
            where: { id: group.id },
            data: { currentCount: { increment: 1 } },
          });
          await tx.groupBuyActivity.update({
            where: { id: activity!.id },
            data: { soldCount: { increment: quantity } },
          });
          if (updatedGroup.currentCount >= updatedGroup.targetCount) {
            await tx.groupBuyGroup.update({
              where: { id: group.id },
              data: { status: 'success', successAt: now },
            });
          }
        }

        return {
          groupId: group.id.toString(),
          groupNo: group.groupNo,
          orderId: order.orderId.toString(),
          role: 'leader',
        };
      },
      { timeout: 15_000 },
    );
  }

  override async joinGroupBuy(userId: string, dto: JoinGroupBuyDto) {
    const quantity = this.assertSupportedQuantity(dto.quantity);
    const userIdValue = BigInt(userId);
    const groupId = BigInt(dto.groupId);

    return this.transactionalPrisma.$transaction(
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

        const activity = await tx.groupBuyActivity.findFirst({
          where: { id: group.activityId, deletedAt: null },
        });
        this.assertActivityValid(activity);
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
          throw new BadRequestException('活动未指定规格，无法参团');
        }

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
        });

        const now = new Date();
        await tx.groupBuyMember.create({
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

        if (order.isZeroPay) {
          const updatedGroup = await tx.groupBuyGroup.update({
            where: { id: group.id },
            data: { currentCount: { increment: 1 } },
          });
          await tx.groupBuyActivity.update({
            where: { id: activity!.id },
            data: { soldCount: { increment: quantity } },
          });
          if (
            updatedGroup.currentCount >= updatedGroup.targetCount &&
            updatedGroup.status === 'forming'
          ) {
            await tx.groupBuyGroup.update({
              where: { id: group.id },
              data: { status: 'success', successAt: now },
            });
          }
        }

        return {
          groupId: group.id.toString(),
          groupNo: group.groupNo,
          orderId: order.orderId.toString(),
          role: 'member',
        };
      },
      { timeout: 15_000 },
    );
  }

  override async weappFindAvailableGroups(activityId: string) {
    const activity = await this.transactionalPrisma.groupBuyActivity.findFirst({
      where: { id: BigInt(activityId), deletedAt: null },
    });
    this.assertActivityValid(activity);

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

  private assertSupportedQuantity(quantityInput?: number): number {
    const quantity = quantityInput ?? 1;
    if (!Number.isInteger(quantity) || quantity !== 1) {
      throw new BadRequestException('拼团当前仅支持每人每次购买1件');
    }
    return quantity;
  }

  private assertActivityValid(activity: {
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
}
