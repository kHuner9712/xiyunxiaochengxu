import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { UserQueryDto } from './dto/user-query.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async getUserInfo(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: BigInt(userId), deletedAt: null },
      include: {
        profile: true,
        memberLevel: true,
        _count: {
          select: { babyProfiles: { where: { deletedAt: null } } },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

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
    const user = await this.prisma.user.findFirst({
      where: { id: BigInt(userId), deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const updateData: any = {};
    if (dto.nickname !== undefined) updateData.nickname = dto.nickname;
    const avatarUrl = dto.avatarUrl ?? dto.avatar;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;
    if (dto.gender !== undefined) updateData.gender = dto.gender;

    if (Object.keys(updateData).length > 0) {
      await this.prisma.user.update({
        where: { id: BigInt(userId) },
        data: updateData,
      });
    }

    return this.getUserInfo(userId);
  }

  async findAll(dto: UserQueryDto) {
    const where: any = { deletedAt: null };

    if (dto.keyword) {
      where.OR = [
        { nickname: { contains: dto.keyword } },
        { phone: { contains: dto.keyword } },
      ];
    }

    if (dto.nickname) {
      where.nickname = { contains: dto.nickname };
    }

    if (dto.phone) {
      where.phone = { contains: dto.phone };
    }

    const memberLevelId = dto.memberLevelId ?? dto.memberLevel;
    if (memberLevelId) {
      where.memberLevelId = BigInt(memberLevelId);
    }

    if (dto.status !== undefined) {
      where.status = dto.status;
    }

    const [list, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: dto.skip,
        take: dto.take,
        orderBy: { createdAt: 'desc' },
        include: {
          profile: true,
          memberLevel: true,
          _count: {
            select: {
              orders: true,
              babyProfiles: { where: { deletedAt: null } },
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      list: list.map((u) => this.serializeUser(u)),
      total,
      page: dto.page,
      pageSize: dto.pageSize,
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: BigInt(id), deletedAt: null },
      include: {
        profile: true,
        memberLevel: true,
        babyProfiles: { where: { deletedAt: null } },
        _count: {
          select: {
            orders: true,
            pointsRecords: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const [orderStats, recentPoints] = await Promise.all([
      this.prisma.order.aggregate({
        where: { userId: BigInt(id), status: { in: ['paid', 'pending_delivery', 'pending_pickup', 'delivered', 'completed'] } },
        _sum: { payAmount: true },
        _count: true,
      }),
      this.prisma.pointsRecord.findMany({
        where: { userId: BigInt(id) },
        take: 10,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      ...this.serializeUser(user),
      orderStats: {
        totalOrders: orderStats._count,
        totalAmount: orderStats._sum.payAmount || 0,
      },
      babyProfiles: user.babyProfiles.map((b) => ({
        id: b.id.toString(),
        userId: b.userId.toString(),
        nickname: b.nickname,
        gender: b.gender,
        birthday: b.birthday,
        currentMonthAge: b.currentMonthAge,
        avatarUrl: b.avatarUrl,
        isDefault: b.isDefault,
      })),
      recentPoints: recentPoints.map((p) => ({
        id: p.id.toString(),
        type: p.type,
        points: p.points,
        balance: p.balance,
        source: p.source,
        description: p.description,
        createdAt: p.createdAt,
      })),
    };
  }

  async adjustLevel(id: string, memberLevelId: number, reason?: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: BigInt(id), deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const level = await this.prisma.memberLevel.findFirst({
      where: { id: BigInt(memberLevelId), status: 1 },
    });

    if (!level) {
      throw new BadRequestException('会员等级不存在');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: BigInt(id) },
        data: { memberLevelId: BigInt(memberLevelId) },
      }),
      this.prisma.userMemberRecord.create({
        data: {
          userId: BigInt(id),
          oldLevelId: user.memberLevelId,
          newLevelId: BigInt(memberLevelId),
          changeReason: reason || '管理员手动调整',
        },
      }),
    ]);

    return this.findOne(id);
  }

  async toggleStatus(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: BigInt(id), deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const newStatus = user.status === 1 ? 0 : 1;

    await this.prisma.user.update({
      where: { id: BigInt(id) },
      data: { status: newStatus },
    });

    return { id: id, status: newStatus };
  }

  private serializeUser(user: any) {
    const orderCount = user._count?.orders ?? 0;
    const babyCount = user._count?.babyProfiles ?? 0;

    return {
      id: user.id.toString(),
      openid: user.openid,
      unionId: user.unionId,
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
        ? {
            id: user.memberLevel.id.toString(),
            name: user.memberLevel.name,
            icon: user.memberLevel.icon,
          }
        : null,
      memberLevelName: user.memberLevel?.name || '普通会员',
      points: user.availablePoints,
      growthValue: user.growthValue,
      totalPoints: user.totalPoints,
      availablePoints: user.availablePoints,
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
      status: user.status,
      lastLoginAt: user.lastLoginAt,
      lastLoginTime: user.lastLoginAt,
      createdAt: user.createdAt,
      createTime: user.createdAt,
      orderCount,
      babyCount,
      _count: user._count
        ? {
            orders: orderCount,
            babyProfiles: babyCount,
          }
        : undefined,
    };
  }

  private maskIdentifier(value?: string | null) {
    if (!value) return '';
    if (value.length <= 8) {
      return `${value.slice(0, 2)}****${value.slice(-2)}`;
    }
    return `${value.slice(0, 4)}****${value.slice(-4)}`;
  }
}
