import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { calculateBabyMonthAge, paginate } from '@baby-mall/shared';
import { CreateBabyProfileDto, UpdateBabyProfileDto } from './dto/create-baby-profile.dto';
import { BabyProfileQueryDto } from './dto/baby-profile-query.dto';

@Injectable()
export class BabyProfileService {
  private readonly logger = new Logger(BabyProfileService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(userId: string) {
    const userIdValue = parsePositiveBigIntId(userId, '用户');
    const profiles = await this.prisma.babyProfile.findMany({
      where: { userId: userIdValue, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    return profiles.map((p) => this.serializeProfile(p));
  }

  async findById(userId: string, id: string) {
    const userIdValue = parsePositiveBigIntId(userId, '用户');
    const profileId = parsePositiveBigIntId(id, '宝宝档案');
    const profile = await this.prisma.babyProfile.findFirst({
      where: { id: profileId, userId: userIdValue, deletedAt: null },
    });
    if (!profile) throw new NotFoundException('宝宝档案不存在');
    return this.serializeProfile(profile);
  }

  async create(userId: string, data: CreateBabyProfileDto) {
    const userIdValue = parsePositiveBigIntId(userId, '用户');
    const birthday = this.parseBirthday(data.birthday);

    const profile = await this.prisma.$transaction(async (tx) => {
      const userRows = await tx.$queryRaw<Array<{ id: bigint }>>`
        SELECT id FROM users WHERE id = ${userIdValue} AND deleted_at IS NULL FOR UPDATE
      `;
      if (userRows.length === 0) throw new NotFoundException('用户不存在');

      const existing = await tx.babyProfile.findMany({
        where: { userId: userIdValue, deletedAt: null },
        orderBy: { createdAt: 'asc' },
      });
      if (existing.length >= 5) throw new BadRequestException('最多添加5个宝宝档案');

      const shouldBeDefault = existing.length === 0 || data.isDefault === 1;
      if (shouldBeDefault && existing.length > 0) {
        await tx.babyProfile.updateMany({
          where: { userId: userIdValue, deletedAt: null },
          data: { isDefault: 0 },
        });
      }

      const avatarUrl = data.avatarUrl ?? data.avatar;
      return tx.babyProfile.create({
        data: {
          userId: userIdValue,
          nickname: data.nickname?.trim() || null,
          gender: data.gender ?? 0,
          birthday,
          currentMonthAge: calculateBabyMonthAge(birthday),
          avatarUrl: avatarUrl?.trim() || null,
          isDefault: shouldBeDefault ? 1 : 0,
        },
      });
    });
    this.logger.log(`用户${userIdValue}创建宝宝档案${profile.id}`);
    return this.serializeProfile(profile);
  }

  async update(userId: string, id: string, data: UpdateBabyProfileDto) {
    const userIdValue = parsePositiveBigIntId(userId, '用户');
    const profileId = parsePositiveBigIntId(id, '宝宝档案');

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userIdValue} AND deleted_at IS NULL FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM baby_profiles WHERE id = ${profileId} AND user_id = ${userIdValue} AND deleted_at IS NULL FOR UPDATE`;
      const profile = await tx.babyProfile.findFirst({
        where: { id: profileId, userId: userIdValue, deletedAt: null },
      });
      if (!profile) throw new NotFoundException('宝宝档案不存在');

      const activeProfiles = await tx.babyProfile.findMany({
        where: { userId: userIdValue, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      if (data.isDefault === 1) {
        await tx.babyProfile.updateMany({
          where: { userId: userIdValue, deletedAt: null, id: { not: profileId } },
          data: { isDefault: 0 },
        });
      } else if (data.isDefault === 0 && profile.isDefault === 1) {
        const replacement = activeProfiles.find((item) => item.id !== profileId);
        if (replacement) {
          await tx.babyProfile.updateMany({
            where: { userId: userIdValue, deletedAt: null },
            data: { isDefault: 0 },
          });
          await tx.babyProfile.update({ where: { id: replacement.id }, data: { isDefault: 1 } });
        } else {
          // A sole profile must remain default; silently accepting zero default would break the
          // personalized home/content paths that assume one current baby.
          data.isDefault = 1;
        }
      }

      const updateData: any = {};
      if (data.nickname !== undefined) updateData.nickname = data.nickname?.trim() || null;
      if (data.gender !== undefined) updateData.gender = data.gender;
      if (data.birthday !== undefined) {
        const birthday = this.parseBirthday(data.birthday);
        updateData.birthday = birthday;
        updateData.currentMonthAge = calculateBabyMonthAge(birthday);
      }
      const avatarUrl = data.avatarUrl ?? data.avatar;
      if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl?.trim() || null;
      if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;

      const updated = await tx.babyProfile.update({ where: { id: profileId }, data: updateData });
      await this.ensureOneDefault(tx, userIdValue);
      return updated;
    });
    this.logger.log(`用户${userIdValue}更新宝宝档案${profileId}`);
    return this.serializeProfile(result);
  }

  async delete(userId: string, id: string) {
    const userIdValue = parsePositiveBigIntId(userId, '用户');
    const profileId = parsePositiveBigIntId(id, '宝宝档案');
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userIdValue} AND deleted_at IS NULL FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM baby_profiles WHERE id = ${profileId} AND user_id = ${userIdValue} AND deleted_at IS NULL FOR UPDATE`;
      const profile = await tx.babyProfile.findFirst({
        where: { id: profileId, userId: userIdValue, deletedAt: null },
      });
      if (!profile) throw new NotFoundException('宝宝档案不存在');

      const deleted = await tx.babyProfile.update({
        where: { id: profileId },
        data: { deletedAt: new Date(), isDefault: 0 },
      });
      if (profile.isDefault === 1) {
        const replacement = await tx.babyProfile.findFirst({
          where: { userId: userIdValue, deletedAt: null },
          orderBy: { createdAt: 'desc' },
        });
        if (replacement) {
          await tx.babyProfile.update({ where: { id: replacement.id }, data: { isDefault: 1 } });
        }
      }
      return deleted;
    });
    this.logger.log(`用户${userIdValue}删除宝宝档案${profileId}`);
    return this.serializeProfile(result);
  }

  async findAllAdmin(dto: BabyProfileQueryDto) {
    const where: any = { deletedAt: null };
    if (dto.userId) where.userId = parsePositiveBigIntId(dto.userId, '用户');

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

  private async ensureOneDefault(tx: any, userId: bigint) {
    const active: any[] = await tx.babyProfile.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    if (active.length === 0) return;
    const defaults = active.filter((item: any) => item.isDefault === 1);
    if (defaults.length === 1) return;
    await tx.babyProfile.updateMany({ where: { userId, deletedAt: null }, data: { isDefault: 0 } });
    await tx.babyProfile.update({ where: { id: (defaults[0] ?? active[0]).id }, data: { isDefault: 1 } });
  }

  private parseBirthday(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('宝宝生日无效');
    if (date.getTime() > Date.now()) throw new BadRequestException('宝宝生日不能晚于今天');
    return date;
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
