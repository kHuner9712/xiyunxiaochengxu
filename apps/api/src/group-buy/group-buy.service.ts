import {
  Injectable,
  Inject,
  forwardRef,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { paginate } from '@baby-mall/shared';
import { OrderService } from '../order/order.service';
import {
  GroupBuyActivityQueryDto,
  GroupBuyActivityDto,
  GroupBuyActivityStatusDto,
  GroupBuyGroupQueryDto,
  GroupBuyMemberQueryDto,
  StartGroupBuyDto,
  JoinGroupBuyDto,
} from './dto/group-buy.dto';

function generateGroupNo(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 1e6)
    .toString(36)
    .toUpperCase()
    .padStart(4, '0');
  return `GB${ts}${rand}`.slice(0, 32);
}

function parseDate(v: string | undefined): Date | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  return isNaN(d.getTime()) ? undefined : d;
}

@Injectable()
export class GroupBuyService {
  private readonly logger = new Logger(GroupBuyService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => OrderService))
    private orderService: OrderService,
  ) {}

  // ============ 后台：活动管理 ============

  async findActivities(query: GroupBuyActivityQueryDto) {
    const { page, pageSize, keyword, status, productId } = query;
    const where: Prisma.GroupBuyActivityWhereInput = { deletedAt: null };
    if (keyword) where.name = { contains: keyword };
    if (status !== undefined) where.status = status;
    if (productId) where.productId = BigInt(productId);

    const [list, total] = await Promise.all([
      this.prisma.groupBuyActivity.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.groupBuyActivity.count({ where }),
    ]);
    return paginate(list, total, page, pageSize);
  }

  async findActivityById(id: string) {
    const activity = await this.prisma.groupBuyActivity.findFirst({
      where: { id: BigInt(id), deletedAt: null },
    });
    if (!activity) throw new NotFoundException('拼团活动不存在');
    return activity;
  }

  async createActivity(dto: GroupBuyActivityDto) {
    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);
    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      throw new BadRequestException('开始/结束时间格式错误');
    }
    if (endTime <= startTime) {
      throw new BadRequestException('结束时间必须晚于开始时间');
    }
    const product = await this.prisma.product.findFirst({
      where: { id: BigInt(dto.productId) },
      select: { id: true, name: true, mainImage: true },
    });
    if (!product) throw new BadRequestException('商品不存在');

    return this.prisma.groupBuyActivity.create({
      data: {
        name: dto.name,
        productId: BigInt(dto.productId),
        skuId: dto.skuId ? BigInt(dto.skuId) : null,
        groupPrice: dto.groupPrice,
        originalPrice: dto.originalPrice ?? null,
        groupSize: dto.groupSize,
        groupExpireHours: dto.groupExpireHours ?? 24,
        stockLimit: dto.stockLimit ?? null,
        limitPerUser: dto.limitPerUser ?? 0,
        startTime,
        endTime,
        status: dto.status ?? 1,
        sortOrder: dto.sortOrder ?? 0,
        description: dto.description ?? null,
        coverImage: dto.coverImage ?? null,
      },
    });
  }

  async updateActivity(id: string, dto: GroupBuyActivityDto) {
    const activity = await this.findActivityById(id);
    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);
    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      throw new BadRequestException('开始/结束时间格式错误');
    }
    if (endTime <= startTime) {
      throw new BadRequestException('结束时间必须晚于开始时间');
    }

    return this.prisma.groupBuyActivity.update({
      where: { id: activity.id },
      data: {
        name: dto.name,
        productId: BigInt(dto.productId),
        skuId: dto.skuId ? BigInt(dto.skuId) : null,
        groupPrice: dto.groupPrice,
        originalPrice: dto.originalPrice ?? null,
        groupSize: dto.groupSize,
        groupExpireHours: dto.groupExpireHours ?? 24,
        stockLimit: dto.stockLimit ?? null,
        limitPerUser: dto.limitPerUser ?? 0,
        startTime,
        endTime,
        status: dto.status ?? activity.status,
        sortOrder: dto.sortOrder ?? 0,
        description: dto.description ?? null,
        coverImage: dto.coverImage ?? null,
      },
    });
  }

  async updateActivityStatus(id: string, dto: GroupBuyActivityStatusDto) {
    await this.findActivityById(id);
    return this.prisma.groupBuyActivity.update({
      where: { id: BigInt(id) },
      data: { status: dto.status },
    });
  }

  async deleteActivity(id: string) {
    await this.findActivityById(id);
    await this.prisma.groupBuyActivity.update({
      where: { id: BigInt(id) },
      data: { deletedAt: new Date() },
    });
    return { success: true };
  }

  // ============ 后台：团单查询 ============

  async findGroups(query: GroupBuyGroupQueryDto) {
    const { page, pageSize, activityId, status, groupNo, leaderUserId } = query;
    const where: Prisma.GroupBuyGroupWhereInput = { deletedAt: null };
    if (activityId) where.activityId = BigInt(activityId);
    if (status) where.status = status;
    if (groupNo) where.groupNo = { contains: groupNo };
    if (leaderUserId) where.leaderUserId = BigInt(leaderUserId);

    const startAt = parseDate(query.startTime);
    const endAt = parseDate(query.endTime);
    if (startAt || endAt) {
      where.createdAt = {};
      if (startAt) where.createdAt.gte = startAt;
      if (endAt) where.createdAt.lte = endAt;
    }

    const [list, total] = await Promise.all([
      this.prisma.groupBuyGroup.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.groupBuyGroup.count({ where }),
    ]);
    return paginate(list, total, page, pageSize);
  }

  async findGroupById(id: string) {
    const group = await this.prisma.groupBuyGroup.findFirst({
      where: { id: BigInt(id), deletedAt: null },
    });
    if (!group) throw new NotFoundException('团单不存在');
    const members = await this.prisma.groupBuyMember.findMany({
      where: { groupId: group.id, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return { ...group, members };
  }

  async findMembers(query: GroupBuyMemberQueryDto) {
    const { page, pageSize, groupId, activityId, userId, orderId, status } = query;
    const where: Prisma.GroupBuyMemberWhereInput = { deletedAt: null };
    if (groupId) where.groupId = BigInt(groupId);
    if (activityId) where.activityId = BigInt(activityId);
    if (userId) where.userId = BigInt(userId);
    if (orderId) where.orderId = BigInt(orderId);
    if (status) where.status = status;

    const [list, total] = await Promise.all([
      this.prisma.groupBuyMember.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.groupBuyMember.count({ where }),
    ]);
    return paginate(list, total, page, pageSize);
  }

  async getStats() {
    const [totalGroups, successGroups, formingGroups, failedGroups, totalMembers, paidMembers] =
      await Promise.all([
        this.prisma.groupBuyGroup.count({ where: { deletedAt: null } }),
        this.prisma.groupBuyGroup.count({ where: { deletedAt: null, status: 'success' } }),
        this.prisma.groupBuyGroup.count({ where: { deletedAt: null, status: 'forming' } }),
        this.prisma.groupBuyGroup.count({ where: { deletedAt: null, status: 'failed' } }),
        this.prisma.groupBuyMember.count({ where: { deletedAt: null } }),
        this.prisma.groupBuyMember.count({ where: { deletedAt: null, status: 'paid' } }),
      ]);

    // 成团订单总金额（按 paid member 的活动拼团价汇总）
    const paidMembersWithActivity = await this.prisma.groupBuyMember.findMany({
      where: { deletedAt: null, status: 'paid' },
      select: { activityId: true },
    });
    const activityIds = Array.from(new Set(paidMembersWithActivity.map((m) => m.activityId)));
    let totalAmount = 0;
    if (activityIds.length > 0) {
      const activities = await this.prisma.groupBuyActivity.findMany({
        where: { id: { in: activityIds } },
        select: { id: true, groupPrice: true },
      });
      const priceMap = new Map(activities.map((a) => [a.id, a.groupPrice]));
      for (const m of paidMembersWithActivity) {
        const price = priceMap.get(m.activityId) ?? 0;
        totalAmount += price;
      }
    }

    return {
      totalGroups,
      successGroups,
      formingGroups,
      failedGroups,
      totalMembers,
      paidMembers,
      totalAmount,
    };
  }

  // ============ 小程序：拼团列表/详情 ============

  async weappFindActivities(query: { page?: number; pageSize?: number }) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const now = new Date();
    const where: Prisma.GroupBuyActivityWhereInput = {
      deletedAt: null,
      status: 1,
      startTime: { lte: now },
      endTime: { gte: now },
    };
    const [list, total] = await Promise.all([
      this.prisma.groupBuyActivity.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.groupBuyActivity.count({ where }),
    ]);
    return paginate(list, total, page, pageSize);
  }

  async weappFindActivityById(id: string) {
    const activity = await this.prisma.groupBuyActivity.findFirst({
      where: { id: BigInt(id), deletedAt: null },
    });
    if (!activity) throw new NotFoundException('拼团活动不存在');
    return activity;
  }

  async weappFindAvailableGroups(activityId: string) {
    const activity = await this.weappFindActivityById(activityId);
    if (activity.status !== 1) {
      throw new BadRequestException('活动已下架');
    }
    const now = new Date();
    if (now < activity.startTime || now > activity.endTime) {
      throw new BadRequestException('活动未在有效期内');
    }

    // 查 forming 且未过期的团
    const groups = await this.prisma.groupBuyGroup.findMany({
      where: {
        activityId: activity.id,
        status: 'forming',
        expiresAt: { gt: now },
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });

    // 查成员（无 Prisma 关系字段，单独查询）
    const groupIds = groups.map((g) => g.id);
    const allMembers = groupIds.length
      ? await this.prisma.groupBuyMember.findMany({
          where: {
            groupId: { in: groupIds },
            deletedAt: null,
            status: { in: ['pending_payment', 'paid'] },
          },
          select: { id: true, groupId: true, userId: true, role: true, status: true, paidAt: true },
        })
      : [];
    const memberMap = new Map<number, typeof allMembers>();
    for (const m of allMembers) {
      const arr = memberMap.get(Number(m.groupId)) ?? [];
      arr.push(m);
      memberMap.set(Number(m.groupId), arr);
    }

    // 补充团长昵称头像
    const userIds = Array.from(
      new Set(groups.map((g) => g.leaderUserId)),
    );
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, nickname: true, avatarUrl: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    return groups.map((g) => ({
      ...g,
      members: memberMap.get(Number(g.id)) ?? [],
      leader: userMap.get(g.leaderUserId) ?? null,
    }));
  }

  async weappFindMyGroups(userId: string, query: { page?: number; pageSize?: number }) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    // 无 Prisma 关系字段，先查我参与的 groupId 集合
    const myMembers = await this.prisma.groupBuyMember.findMany({
      where: { userId: BigInt(userId), deletedAt: null },
      select: { groupId: true },
    });
    const groupIds = Array.from(new Set(myMembers.map((m) => m.groupId)));
    if (groupIds.length === 0) {
      return paginate([], 0, page, pageSize);
    }
    const where: Prisma.GroupBuyGroupWhereInput = {
      deletedAt: null,
      id: { in: groupIds },
    };
    const [list, total] = await Promise.all([
      this.prisma.groupBuyGroup.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.groupBuyGroup.count({ where }),
    ]);
    // 补充活动信息
    const activityIds = Array.from(new Set(list.map((g) => g.activityId)));
    const activities = activityIds.length
      ? await this.prisma.groupBuyActivity.findMany({
          where: { id: { in: activityIds } },
          select: { id: true, name: true, coverImage: true, groupPrice: true, groupSize: true },
        })
      : [];
    const activityMap = new Map(activities.map((a) => [a.id, a]));
    const listWithActivity = list.map((g) => ({
      ...g,
      activity: activityMap.get(g.activityId) ?? null,
    }));
    return paginate(listWithActivity, total, page, pageSize);
  }

  async weappFindGroupById(id: string) {
    const group = await this.prisma.groupBuyGroup.findFirst({
      where: { id: BigInt(id), deletedAt: null },
    });
    if (!group) throw new NotFoundException('团单不存在');

    // 单独查活动信息和成员（无 Prisma 关系字段）
    const [activity, members] = await Promise.all([
      this.prisma.groupBuyActivity.findFirst({
        where: { id: group.activityId, deletedAt: null },
      }),
      this.prisma.groupBuyMember.findMany({
        where: { groupId: group.id, deletedAt: null },
        orderBy: { createdAt: 'asc' },
        select: { id: true, userId: true, role: true, status: true, paidAt: true, createdAt: true, orderId: true },
      }),
    ]);

    const userIds = Array.from(new Set(members.map((m) => m.userId)));
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, nickname: true, avatarUrl: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));
    return {
      ...group,
      activity,
      members: members.map((m) => ({ ...m, user: userMap.get(m.userId) ?? null })),
    };
  }

  // ============ 小程序：开团 / 参团 ============

  /**
   * 开团：创建 group + leader member(pending_payment) + 调用 orderService.create 生成订单
   * 失败回滚 group/member（依赖 prisma 事务 + 订单创建抛错自动回滚 member）。
   */
  async startGroupBuy(userId: string, dto: StartGroupBuyDto) {
    const activity = await this.weappFindActivityById(String(dto.activityId));
    this.assertActivityValid(activity);
    await this.assertStockAvailable(activity, 1);
    await this.assertUserLimit(activity, BigInt(userId));

    const quantity = dto.quantity ?? 1;
    const skuId = activity.skuId
      ? activity.skuId
      : dto.skuId
        ? BigInt(dto.skuId)
        : null;
    if (!skuId) {
      throw new BadRequestException('请选择商品规格');
    }

    // 创建团
    const expiresAt = new Date(Date.now() + activity.groupExpireHours * 3600 * 1000);
    const group = await this.prisma.groupBuyGroup.create({
      data: {
        activityId: activity.id,
        leaderUserId: BigInt(userId),
        status: 'forming',
        groupNo: generateGroupNo(),
        currentCount: 0,
        targetCount: activity.groupSize,
        expiresAt,
      },
    });

    // 创建订单（复用现有 orderService.create）
    let orderId: bigint;
    try {
      const order = await this.orderService.create(userId, {
        items: [{ skuId: skuId.toString(), quantity }],
        addressId: dto.addressId,
        pickupStoreId: dto.pickupStoreId,
        fulfillmentType: dto.fulfillmentType,
        remark: dto.remark,
        sourceType: 'direct',
      });
      orderId = BigInt(order.orderId);
    } catch (err) {
      // 订单创建失败：标记团 cancelled 并抛出
      await this.prisma.groupBuyGroup.update({
        where: { id: group.id },
        data: { status: 'cancelled' },
      });
      throw err;
    }

    // 创建 leader 成员记录（pending_payment，关联 orderId）
    try {
      await this.prisma.groupBuyMember.create({
        data: {
          groupId: group.id,
          activityId: activity.id,
          userId: BigInt(userId),
          orderId,
          role: 'leader',
          status: 'pending_payment',
        },
      });
    } catch (err) {
      // 唯一冲突理论上不会发生（新团），但兜底
      this.logger.error(
        `开团成员记录创建失败: groupId=${group.id}, userId=${userId}, orderId=${orderId}`,
        (err as Error).message,
      );
      throw err;
    }

    return {
      groupId: group.id.toString(),
      groupNo: group.groupNo,
      orderId: orderId.toString(),
      role: 'leader',
    };
  }

  /**
   * 参团：校验 group + 创建 member(pending_payment) + 调用 orderService.create 生成订单
   */
  async joinGroupBuy(userId: string, dto: JoinGroupBuyDto) {
    const group = await this.prisma.groupBuyGroup.findFirst({
      where: { id: BigInt(dto.groupId), deletedAt: null },
    });
    if (!group) throw new NotFoundException('团单不存在');
    if (group.status !== 'forming') {
      throw new BadRequestException('该团已不可加入');
    }
    if (group.expiresAt < new Date()) {
      throw new BadRequestException('该团已过期');
    }
    if (group.currentCount >= group.targetCount) {
      throw new BadRequestException('该团已满');
    }

    const activity = await this.weappFindActivityById(String(group.activityId));
    this.assertActivityValid(activity);
    await this.assertStockAvailable(activity, 1);
    await this.assertUserLimit(activity, BigInt(userId));

    // 校验用户未加入该团
    const existed = await this.prisma.groupBuyMember.findFirst({
      where: { groupId: group.id, userId: BigInt(userId), deletedAt: null },
      select: { id: true },
    });
    if (existed) {
      throw new BadRequestException('你已加入该团');
    }

    const quantity = dto.quantity ?? 1;
    const skuId = activity.skuId
      ? activity.skuId
      : null;
    if (!skuId) {
      throw new BadRequestException('活动未指定规格，无法参团');
    }

    // 创建订单
    let orderId: bigint;
    try {
      const order = await this.orderService.create(userId, {
        items: [{ skuId: skuId.toString(), quantity }],
        addressId: dto.addressId,
        pickupStoreId: dto.pickupStoreId,
        fulfillmentType: dto.fulfillmentType,
        remark: dto.remark,
        sourceType: 'direct',
      });
      orderId = BigInt(order.orderId);
    } catch (err) {
      throw err;
    }

    // 创建 member 记录
    try {
      await this.prisma.groupBuyMember.create({
        data: {
          groupId: group.id,
          activityId: activity.id,
          userId: BigInt(userId),
          orderId,
          role: 'member',
          status: 'pending_payment',
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new BadRequestException('你已加入该团');
      }
      throw err;
    }

    return {
      groupId: group.id.toString(),
      groupNo: group.groupNo,
      orderId: orderId.toString(),
      role: 'member',
    };
  }

  // ============ 支付成功后成团处理（由 payment.service 调用） ============

  /**
   * 订单支付成功后调用，更新 member 状态、currentCount，达成则成团。
   * 幂等：通过 member.status 判断，重复调用安全跳过。
   * 失败不影响支付主流程（调用方需 try/catch）。
   */
  async handlePaymentSuccess(orderId: bigint | string): Promise<void> {
    const member = await this.prisma.groupBuyMember.findFirst({
      where: { orderId: BigInt(orderId), deletedAt: null },
    });
    if (!member) {
      // 非拼团订单，忽略
      return;
    }
    if (member.status === 'paid') {
      // 幂等：已支付，跳过
      this.logger.debug(`拼团成员已支付，幂等跳过: orderId=${orderId}`);
      return;
    }
    if (member.status === 'cancelled' || member.status === 'refunded') {
      this.logger.warn(`拼团成员状态为${member.status}，跳过: orderId=${orderId}`);
      return;
    }

    const now = new Date();
    // 更新 member + currentCount + 可能的成团
    await this.prisma.$transaction(async (tx) => {
      // 乐观锁更新 member
      const memberResult = await tx.groupBuyMember.updateMany({
        where: { id: member.id, status: 'pending_payment' },
        data: { status: 'paid', paidAt: now },
      });
      if (memberResult.count === 0) {
        // 并发已被处理，跳过
        return;
      }

      // currentCount + 1
      const updated = await tx.groupBuyGroup.update({
        where: { id: member.groupId },
        data: { currentCount: { increment: 1 } },
      });

      // 达成目标则成团
      if (updated.currentCount >= updated.targetCount && updated.status === 'forming') {
        await tx.groupBuyGroup.update({
          where: { id: updated.id, status: 'forming' },
          data: { status: 'success', successAt: now },
        });
        this.logger.log(`拼团成功: groupId=${updated.id}, groupNo=${updated.groupNo}`);
      }

      // 活动库存 soldCount + 1
      await tx.groupBuyActivity.update({
        where: { id: member.activityId },
        data: { soldCount: { increment: 1 } },
      });
    });
  }

  /**
   * 订单取消后调用，将 member 标记为 cancelled。
   * 幂等：已 cancelled/refunded 跳过。
   * 失败不影响主流程（调用方需 try/catch）。
   */
  async handleOrderCancel(orderId: bigint | string): Promise<void> {
    const member = await this.prisma.groupBuyMember.findFirst({
      where: { orderId: BigInt(orderId), deletedAt: null },
    });
    if (!member) return;
    if (member.status === 'cancelled' || member.status === 'refunded') return;
    if (member.status === 'paid') {
      // 已支付 member 不自动取消（需走退款流程）
      this.logger.warn(
        `拼团成员已支付，不自动取消: orderId=${orderId}, memberId=${member.id}`,
      );
      // TODO: 拼团失败/退款的自动处理留待后续阶段
      return;
    }
    await this.prisma.groupBuyMember.update({
      where: { id: member.id },
      data: { status: 'cancelled' },
    });
  }

  // ============ 后台：手动标记过期团 ============

  /**
   * 将 expiresAt < now 且 status=forming 的团标记为 failed。
   * 不自动退款，只记录失败状态。
   */
  async markExpiredGroups(): Promise<{ affected: number }> {
    const now = new Date();
    const result = await this.prisma.groupBuyGroup.updateMany({
      where: {
        status: 'forming',
        expiresAt: { lt: now },
        deletedAt: null,
      },
      data: { status: 'failed', failedAt: now },
    });
    if (result.count > 0) {
      this.logger.log(`标记过期团失败: ${result.count} 个`);
    }
    return { affected: result.count };
  }

  // ============ 内部校验 ============

  private assertActivityValid(activity: any) {
    if (activity.status !== 1) {
      throw new BadRequestException('活动已下架');
    }
    const now = new Date();
    if (now < activity.startTime) {
      throw new BadRequestException('活动未开始');
    }
    if (now > activity.endTime) {
      throw new BadRequestException('活动已结束');
    }
  }

  private async assertStockAvailable(activity: any, quantity: number) {
    if (activity.stockLimit != null) {
      if (activity.soldCount + quantity > activity.stockLimit) {
        throw new BadRequestException('活动库存不足');
      }
    }
  }

  private async assertUserLimit(activity: any, userId: bigint) {
    if (!activity.limitPerUser || activity.limitPerUser <= 0) return;
    const count = await this.prisma.groupBuyMember.count({
      where: {
        activityId: activity.id,
        userId,
        deletedAt: null,
        status: { in: ['pending_payment', 'paid'] },
      },
    });
    if (count >= activity.limitPerUser) {
      throw new BadRequestException(`超过每人限购${activity.limitPerUser}次`);
    }
  }
}
