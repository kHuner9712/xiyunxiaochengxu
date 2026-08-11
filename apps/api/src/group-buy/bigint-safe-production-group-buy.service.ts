import { BadRequestException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { BenefitPackageService } from '../benefit-package/benefit-package.service';
import { OrderService } from '../order/order.service';
import { PromotionCheckoutService } from '../order/promotion-checkout.service';
import { ProductionGroupBuyService } from './production-group-buy.service';

@Injectable()
export class BigintSafeProductionGroupBuyService extends ProductionGroupBuyService {
  constructor(
    private readonly bigintSafePrisma: PrismaService,
    @Inject(forwardRef(() => OrderService))
    orderService: OrderService,
    promotionCheckout: PromotionCheckoutService,
    benefitPackageService: BenefitPackageService,
  ) {
    super(bigintSafePrisma, orderService, promotionCheckout, benefitPackageService);
  }

  override async weappFindActivityById(id: string) {
    const activity = await super.weappFindActivityById(id);
    if (activity.status !== 1) {
      throw new NotFoundException('拼团活动不存在或已下架');
    }
    return activity;
  }

  override async weappFindGroupById(id: string) {
    parsePositiveBigIntId(id, '团');
    return super.weappFindGroupById(id);
  }

  override async weappFindMyGroups(
    userId: string,
    query: { page?: number; pageSize?: number },
  ) {
    parsePositiveBigIntId(userId, '用户');
    const result: any = await super.weappFindMyGroups(userId, query);
    return {
      ...result,
      list: (result.list ?? []).map((group: any) => ({
        id: group.id.toString(),
        activityId: group.activityId.toString(),
        status: group.status,
        groupNo: group.groupNo,
        currentCount: group.currentCount,
        targetCount: group.targetCount,
        expiresAt: group.expiresAt,
        successAt: group.successAt ?? null,
        failedAt: group.failedAt ?? null,
        createdAt: group.createdAt,
        activity: group.activity
          ? {
              id: group.activity.id.toString(),
              name: group.activity.name,
              coverImage: group.activity.coverImage ?? null,
              groupPrice: group.activity.groupPrice,
              groupSize: group.activity.groupSize,
            }
          : null,
      })),
    };
  }

  override async weappFindAvailableGroups(activityIdInput: string) {
    const activityId = parsePositiveBigIntId(activityIdInput, '活动');
    const activity = await this.bigintSafePrisma.groupBuyActivity.findFirst({
      where: { id: activityId, deletedAt: null, status: 1 },
    });
    if (!activity) throw new NotFoundException('拼团活动不存在或已下架');

    const now = new Date();
    if (now < activity.startTime || now > activity.endTime) {
      throw new BadRequestException('活动未在有效期内');
    }

    const groups = await this.bigintSafePrisma.groupBuyGroup.findMany({
      where: {
        activityId: activity.id,
        status: 'forming',
        expiresAt: { gt: now },
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });

    const groupIds = groups.map((group) => group.id);
    const members = groupIds.length
      ? await this.bigintSafePrisma.groupBuyMember.findMany({
          where: {
            groupId: { in: groupIds },
            deletedAt: null,
            status: { in: ['pending_payment', 'paid'] },
          },
          select: { id: true, groupId: true, userId: true, role: true, status: true, paidAt: true },
        })
      : [];

    const memberMap = new Map<string, typeof members>();
    for (const member of members) {
      const key = member.groupId.toString();
      const groupMembers = memberMap.get(key) ?? [];
      groupMembers.push(member);
      memberMap.set(key, groupMembers);
    }

    const leaderUserIds = Array.from(new Set(groups.map((group) => group.leaderUserId)));
    const leaders = leaderUserIds.length
      ? await this.bigintSafePrisma.user.findMany({
          where: { id: { in: leaderUserIds } },
          select: { id: true, nickname: true, avatarUrl: true },
        })
      : [];
    const leaderMap = new Map(leaders.map((leader) => [leader.id.toString(), leader]));

    return groups.map((group) => ({
      ...group,
      members: memberMap.get(group.id.toString()) ?? [],
      leader: leaderMap.get(group.leaderUserId.toString()) ?? null,
    }));
  }
}
