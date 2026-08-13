import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { UserQueryDto } from './dto/user-query.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

const REVENUE_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.paid,
  OrderStatus.pending_delivery,
  OrderStatus.pending_pickup,
  OrderStatus.delivered,
  OrderStatus.completed,
];

type UserOrderStats = {
  orderCount: number;
  totalSpent: number;
};

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async getUserInfo(userId: string) {
    const userIdValue = parsePositiveBigIntId(userId, '用户');
    const user = await this.prisma.user.findFirst({
      where: { id: userIdValue, deletedAt: null },
      include: {
        profile: true,
        memberLevel: true,
        _count: { select: { babyProfiles: { where: { deletedAt: null } } } },
      },
    });
    if (!user) throw new NotFoundException('用户不存在');

    return {
      id: user.id.toString(),
      phone: user.phone,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      avatar: user.avatarUrl,
      profileComplete: !!(user.nickname && user.avatarUrl),
      gender: user.gender,
      memberLevelId: user.memberLevelId?.toString(),
      memberLevel: user.memberLevel
        ? {
            id: user.memberLevel.id.toString(),
            name: user.memberLevel.name,
            icon: user.memberLevel.icon,
            discountRate: user.memberLevel.discountRate,
            pointsRate: user.memberLevel.pointsRate,
          }
        : null,
      memberLevelName: user.memberLevel?.name || '普通会员',
      points: user.availablePoints,
      growthValue: user.growthValue,
      totalPoints: user.totalPoints,
      availablePoints: user.availablePoints,
      babyCount: user._count.babyProfiles,
      profile: user.profile
        ? {
            id: user.profile.id.toString(),
            userId: user.profile.userId.toString(),
            realName: user.profile.realName,
            birthday: user.profile.birthday,
            babyCount: user.profile.babyCount,
            source: user.profile.source,
          }
        : null,
      lastLoginAt: user.lastLoginAt,
      status: user.status,
      createdAt: user.createdAt,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const userIdValue = parsePositiveBigIntId(userId, '用户');
    const user = await this.prisma.user.findFirst({ where: { id: userIdValue, deletedAt: null } });
    if (!user) throw new NotFoundException('用户不存在');

    const updateData: any = {};
    if (dto.nickname !== undefined) updateData.nickname = dto.nickname;
    const avatarUrl = dto.avatarUrl ?? dto.avatar;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;
    if (dto.gender !== undefined) updateData.gender = dto.gender;
    if (Object.keys(updateData).length > 0) {
      const updated = await this.prisma.user.updateMany({
        where: { id: userIdValue, deletedAt: null },
        data: updateData,
      });
      if (updated.count !== 1) throw new NotFoundException('用户不存在');
    }
    return this.getUserInfo(userId);
  }

  async findAll(dto: UserQueryDto) {
    const where: any = { deletedAt: null };
    if (dto.keyword) where.OR = [{ nickname: { contains: dto.keyword } }, { phone: { contains: dto.keyword } }];
    if (dto.nickname) where.nickname = { contains: dto.nickname };
    if (dto.phone) where.phone = { contains: dto.phone };
    const memberLevelId = dto.memberLevelId ?? dto.memberLevel;
    if (memberLevelId) where.memberLevelId = parsePositiveBigIntId(memberLevelId, '会员等级');
    if (dto.status !== undefined) where.status = dto.status;

    const [list, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: dto.skip,
        take: dto.take,
        orderBy: { createdAt: 'desc' },
        include: {
          profile: true,
          memberLevel: true,
          _count: { select: { babyProfiles: { where: { deletedAt: null } } } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const userIds = list.map((user) => user.id);
    const groupedOrderStats = userIds.length > 0
      ? await this.prisma.order.groupBy({
          by: ['userId'],
          where: {
            userId: { in: userIds },
            status: { in: REVENUE_ORDER_STATUSES },
          },
          _sum: { payAmount: true },
          _count: { _all: true },
        })
      : [];
    const orderStatsByUserId = new Map<string, UserOrderStats>(
      groupedOrderStats.map((stat) => [
        stat.userId.toString(),
        {
          orderCount: stat._count._all,
          totalSpent: stat._sum.payAmount || 0,
        },
      ]),
    );

    return {
      list: list.map((user) => this.serializeUser(
        user,
        orderStatsByUserId.get(user.id.toString()) || { orderCount: 0, totalSpent: 0 },
      )),
      total,
      page: dto.page,
      pageSize: dto.pageSize,
    };
  }

  async findOne(id: string) {
    const userId = parsePositiveBigIntId(id, '用户');
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: {
        profile: true,
        memberLevel: true,
        babyProfiles: { where: { deletedAt: null } },
        _count: { select: { pointsRecords: true } },
      },
    });
    if (!user) throw new NotFoundException('用户不存在');

    const [orderStats, recentOrders, recentPoints] = await Promise.all([
      this.prisma.order.aggregate({
        where: { userId, status: { in: REVENUE_ORDER_STATUSES } },
        _sum: { payAmount: true },
        _count: true,
      }),
      this.prisma.order.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          orderNo: true,
          status: true,
          totalAmount: true,
          payAmount: true,
          createdAt: true,
        },
      }),
      this.prisma.pointsRecord.findMany({ where: { userId }, take: 10, orderBy: { createdAt: 'desc' } }),
    ]);

    const totalSpent = orderStats._sum.payAmount || 0;
    const orderCount = orderStats._count;
    const avgOrderAmount = orderCount > 0 ? Math.round(totalSpent / orderCount) : 0;

    return {
      ...this.serializeUser(user, { orderCount, totalSpent }),
      avgOrderAmount,
      orderStats: { totalOrders: orderCount, totalAmount: totalSpent },
      babyProfiles: user.babyProfiles.map((b) => ({
        id: b.id.toString(), userId: b.userId.toString(), nickname: b.nickname, gender: b.gender,
        birthday: b.birthday, currentMonthAge: b.currentMonthAge, avatarUrl: b.avatarUrl, isDefault: b.isDefault,
      })),
      recentOrders: recentOrders.map((order) => ({
        id: order.id.toString(),
        orderNo: order.orderNo,
        status: order.status,
        totalAmount: order.payAmount ?? order.totalAmount,
        createTime: order.createdAt,
      })),
      recentPoints: recentPoints.map((p) => ({
        id: p.id.toString(), type: p.type, points: p.points, balance: p.balance,
        source: p.source, description: p.description, createdAt: p.createdAt,
      })),
    };
  }

  async adjustLevel(id: string, memberLevelId: string, reason?: string) {
    const userId = parsePositiveBigIntId(id, '用户');
    const levelId = parsePositiveBigIntId(memberLevelId, '会员等级');

    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} AND deleted_at IS NULL FOR UPDATE`;
      const [user, level] = await Promise.all([
        tx.user.findFirst({ where: { id: userId, deletedAt: null } }),
        tx.memberLevel.findFirst({ where: { id: levelId, status: 1 } }),
      ]);
      if (!user) throw new NotFoundException('用户不存在');
      if (!level) throw new BadRequestException('会员等级不存在或已停用');

      const growthInTargetRange = user.growthValue >= level.minGrowthValue
        && (level.maxGrowthValue === null || user.growthValue <= level.maxGrowthValue);
      const nextGrowthValue = growthInTargetRange ? user.growthValue : level.minGrowthValue;
      if (user.memberLevelId === level.id && user.growthValue === nextGrowthValue) return;

      await tx.user.update({
        where: { id: userId },
        data: { memberLevelId: level.id, growthValue: nextGrowthValue },
      });
      await tx.userMemberRecord.create({
        data: {
          userId,
          oldLevelId: user.memberLevelId,
          newLevelId: level.id,
          changeReason: `${reason?.trim() || '管理员手动调整'}；成长值同步为${nextGrowthValue}以保持等级规则一致`,
        },
      });
    });
    return this.findOne(id);
  }

  async toggleStatus(id: string) {
    const userId = parsePositiveBigIntId(id, '用户');
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw new NotFoundException('用户不存在');
    const newStatus = user.status === 1 ? 0 : 1;
    await this.prisma.user.update({ where: { id: userId }, data: { status: newStatus } });
    return { id: userId.toString(), status: newStatus };
  }

  private serializeUser(user: any, orderStats: UserOrderStats = { orderCount: 0, totalSpent: 0 }) {
    const babyCount = user._count?.babyProfiles ?? 0;
    return {
      id: user.id.toString(),
      openidMasked: this.maskIdentifier(user.openid),
      unionIdMasked: this.maskIdentifier(user.unionId),
      phone: user.phone,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      avatar: user.avatarUrl,
      profileComplete: !!(user.nickname && user.avatarUrl),
      gender: user.gender,
      memberLevelId: user.memberLevelId?.toString(),
      memberLevel: user.memberLevel
        ? { id: user.memberLevel.id.toString(), name: user.memberLevel.name, icon: user.memberLevel.icon }
        : null,
      memberLevelName: user.memberLevel?.name || '普通会员',
      points: user.availablePoints,
      growthValue: user.growthValue,
      totalPoints: user.totalPoints,
      availablePoints: user.availablePoints,
      profile: user.profile
        ? {
            id: user.profile.id.toString(), userId: user.profile.userId.toString(), realName: user.profile.realName,
            birthday: user.profile.birthday, babyCount: user.profile.babyCount, source: user.profile.source,
          }
        : null,
      status: user.status,
      lastLoginAt: user.lastLoginAt,
      lastLoginTime: user.lastLoginAt,
      createdAt: user.createdAt,
      createTime: user.createdAt,
      orderCount: orderStats.orderCount,
      totalSpent: orderStats.totalSpent,
      babyCount,
      _count: user._count ? { orders: orderStats.orderCount, babyProfiles: babyCount } : undefined,
    };
  }

  private maskIdentifier(value?: string | null) {
    if (!value) return '';
    if (value.length <= 8) return `${value.slice(0, 2)}****${value.slice(-2)}`;
    return `${value.slice(0, 4)}****${value.slice(-4)}`;
  }
}
