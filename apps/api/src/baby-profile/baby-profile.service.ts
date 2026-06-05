import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { calculateBabyMonthAge, paginate } from '@baby-mall/shared';
import { PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class BabyProfileService {
  private readonly logger = new Logger(BabyProfileService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(userId: string) {
    const profiles = await this.prisma.babyProfile.findMany({
      where: { userId: BigInt(userId), deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    return profiles.map((p) => this.serializeProfile(p));
  }

  async findById(userId: string, id: string) {
    const profile = await this.prisma.babyProfile.findFirst({
      where: { id: BigInt(id), userId: BigInt(userId), deletedAt: null },
    });
    if (!profile) throw new NotFoundException('宝宝档案不存在');
    return this.serializeProfile(profile);
  }

  async create(userId: string, data: {
    nickname?: string;
    gender?: number;
    birthday: string;
    avatarUrl?: string;
    avatar?: string;
    isDefault?: number;
  }) {
    if (data.isDefault === 1) {
      await this.prisma.babyProfile.updateMany({
        where: { userId: BigInt(userId), deletedAt: null },
        data: { isDefault: 0 },
      });
    }

    const { avatar, avatarUrl: rawAvatarUrl, ...profileData } = data;
    const avatarUrl = rawAvatarUrl ?? avatar;

    const profile = await this.prisma.babyProfile.create({
      data: {
        userId: BigInt(userId),
        ...profileData,
        avatarUrl,
        birthday: new Date(data.birthday),
        currentMonthAge: calculateBabyMonthAge(data.birthday),
      },
    });
    this.logger.log(`用户${userId}创建宝宝档案`);
    return this.serializeProfile(profile);
  }

  async update(userId: string, id: string, data: any) {
    const profile = await this.prisma.babyProfile.findFirst({
      where: { id: BigInt(id), userId: BigInt(userId), deletedAt: null },
    });
    if (!profile) throw new NotFoundException('宝宝档案不存在');

    if (data.isDefault === 1) {
      await this.prisma.babyProfile.updateMany({
        where: { userId: BigInt(userId), deletedAt: null },
        data: { isDefault: 0 },
      });
    }

    const updateData: any = { ...data };
    const avatarUrl = data.avatarUrl ?? data.avatar;
    delete updateData.avatar;
    if (avatarUrl !== undefined) {
      updateData.avatarUrl = avatarUrl;
    }
    if (data.birthday) {
      updateData.birthday = new Date(data.birthday);
      updateData.currentMonthAge = calculateBabyMonthAge(data.birthday);
    }

    const result = await this.prisma.babyProfile.update({
      where: { id: BigInt(id) },
      data: updateData,
    });
    this.logger.log(`用户${userId}更新宝宝档案${id}`);
    return this.serializeProfile(result);
  }

  async delete(userId: string, id: string) {
    const profile = await this.prisma.babyProfile.findFirst({
      where: { id: BigInt(id), userId: BigInt(userId), deletedAt: null },
    });
    if (!profile) throw new NotFoundException('宝宝档案不存在');

    const result = await this.prisma.babyProfile.update({
      where: { id: BigInt(id) },
      data: { deletedAt: new Date() },
    });
    this.logger.log(`用户${userId}删除宝宝档案${id}`);
    return this.serializeProfile(result);
  }

  async findAllAdmin(dto: PaginationDto & { userId?: string }) {
    const where: any = { deletedAt: null };
    if (dto.userId) where.userId = BigInt(dto.userId);

    const [list, total] = await Promise.all([
      this.prisma.babyProfile.findMany({
        where,
        skip: dto.skip,
        take: dto.take,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, nickname: true, phone: true } } },
      }),
      this.prisma.babyProfile.count({ where }),
    ]);

    return paginate(
      list.map((p) => ({
        ...this.serializeProfile(p),
        user: p.user ? { ...p.user, id: p.user.id.toString() } : null,
      })),
      total,
      dto.page,
      dto.pageSize,
    );
  }

  private serializeProfile(profile: any) {
    const avatarUrl = profile.avatarUrl || '';
    return {
      ...profile,
      id: profile.id.toString(),
      userId: profile.userId.toString(),
      avatarUrl,
      avatar: avatarUrl,
      currentMonthAge: calculateBabyMonthAge(profile.birthday),
    };
  }
}
