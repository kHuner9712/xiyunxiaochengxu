import { BadRequestException, Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { UpdateMemberLevelDto } from './dto/update-member-level.dto';

@Injectable()
export class MemberService {
  private readonly logger = new Logger(MemberService.name);

  constructor(private prisma: PrismaService) {}

  async findAllLevels() {
    const levels = await this.prisma.memberLevel.findMany({
      orderBy: [{ minGrowthValue: 'asc' }, { sortOrder: 'asc' }],
    });
    return levels.map((level, index) => this.serializeLevel(level, index));
  }

  async getMemberInfo(userId: string) {
    const userIdValue = parsePositiveBigIntId(userId, '用户');
    const [user, levels] = await Promise.all([
      this.prisma.user.findFirst({
        where: { id: userIdValue, deletedAt: null },
        include: { memberLevel: true },
      }),
      this.getActiveLevels(),
    ]);
    if (!user) throw new NotFoundException('用户不存在');
    if (levels.length === 0) throw new BadRequestException('会员等级尚未配置');

    const currentIndex = this.resolveLevelIndex(levels, user.growthValue);
    const current = levels[currentIndex];
    const next = levels[currentIndex + 1] ?? null;
    const rights = this.getLevelBenefits(current.benefits, currentIndex, current.name, current.pointsRate);

    return {
      level: currentIndex,
      levelId: current.id.toString(),
      levelName: current.name,
      growthValue: user.growthValue,
      currentLevelGrowth: user.growthValue,
      currentLevelMinGrowth: current.minGrowthValue,
      nextLevelGrowth: next?.minGrowthValue ?? user.growthValue,
      rights: rights.map((right) => right.name),
      currentLevel: current.name,
      currentLevelCode: currentIndex,
      discountRate: current.discountRate,
      pointsRate: current.pointsRate,
      nextLevel: next?.name ?? null,
      growthGap: next ? Math.max(0, next.minGrowthValue - user.growthValue) : 0,
      memberLevel: this.serializeLevel(current, currentIndex),
    };
  }

  async getBenefits(userId: string) {
    const userIdValue = parsePositiveBigIntId(userId, '用户');
    const [user, levels] = await Promise.all([
      this.prisma.user.findFirst({ where: { id: userIdValue, deletedAt: null } }),
      this.getActiveLevels(),
    ]);
    if (!user) throw new NotFoundException('用户不存在');
    if (levels.length === 0) return [];
    const levelIndex = this.resolveLevelIndex(levels, user.growthValue);
    const current = levels[levelIndex];
    return this.getLevelBenefits(current.benefits, levelIndex, current.name, current.pointsRate);
  }

  async findLevelById(id: string) {
    const levelId = parsePositiveBigIntId(id, '会员等级');
    const levels = await this.prisma.memberLevel.findMany({
      orderBy: [{ minGrowthValue: 'asc' }, { sortOrder: 'asc' }],
    });
    const index = levels.findIndex((level) => level.id === levelId);
    if (index < 0) throw new NotFoundException('会员等级不存在');
    return this.serializeLevel(levels[index], index);
  }

  async createLevel(dto: UpdateMemberLevelDto) {
    if (!dto.name || dto.minGrowthValue === undefined) {
      throw new BadRequestException('新增会员等级必须填写名称和最低成长值');
    }
    const benefits = this.normalizeBenefits(dto.benefits, dto.name, dto.pointsRate ?? 10);
    const level = await this.prisma.memberLevel.create({
      data: {
        name: dto.name.trim(),
        icon: dto.icon || null,
        minGrowthValue: dto.minGrowthValue,
        maxGrowthValue: dto.maxGrowthValue ?? null,
        discountRate: dto.discountRate ?? null,
        pointsRate: dto.pointsRate ?? 10,
        benefits,
        sortOrder: dto.sortOrder ?? dto.minGrowthValue,
        status: dto.status ?? 1,
      },
    });
    try {
      await this.assertValidActiveLevelRanges();
    } catch (error) {
      await this.prisma.memberLevel.delete({ where: { id: level.id } });
      throw error;
    }
    await this.reconcileAllUserLevels('会员等级配置变更');
    this.logger.log(`创建会员等级：${level.id}`);
    return this.findLevelById(level.id.toString());
  }

  async updateLevel(id: string, dto: UpdateMemberLevelDto) {
    const levelId = parsePositiveBigIntId(id, '会员等级');
    const current = await this.prisma.memberLevel.findUnique({ where: { id: levelId } });
    if (!current) throw new NotFoundException('会员等级不存在');

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.icon !== undefined) data.icon = dto.icon || null;
    if (dto.minGrowthValue !== undefined) data.minGrowthValue = dto.minGrowthValue;
    if (dto.maxGrowthValue !== undefined) data.maxGrowthValue = dto.maxGrowthValue;
    if (dto.discountRate !== undefined) data.discountRate = dto.discountRate;
    if (dto.pointsRate !== undefined) data.pointsRate = dto.pointsRate;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.benefits !== undefined) {
      data.benefits = this.normalizeBenefits(dto.benefits, dto.name ?? current.name, dto.pointsRate ?? current.pointsRate);
    }

    await this.prisma.memberLevel.update({ where: { id: levelId }, data });
    try {
      await this.assertValidActiveLevelRanges();
    } catch (error) {
      await this.prisma.memberLevel.update({
        where: { id: levelId },
        data: {
          name: current.name,
          icon: current.icon,
          minGrowthValue: current.minGrowthValue,
          maxGrowthValue: current.maxGrowthValue,
          discountRate: current.discountRate,
          pointsRate: current.pointsRate,
          benefits: current.benefits,
          sortOrder: current.sortOrder,
          status: current.status,
        },
      });
      throw error;
    }
    await this.reconcileAllUserLevels('会员等级配置变更');
    this.logger.log(`更新会员等级：${id}`);
    return this.findLevelById(id);
  }

  async checkAndUpgradeLevel(userId: string) {
    const userIdValue = parsePositiveBigIntId(userId, '用户');
    const levels = await this.getActiveLevels();
    if (levels.length === 0) return;

    await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: bigint }>>`
        SELECT id FROM users WHERE id = ${userIdValue} AND deleted_at IS NULL FOR UPDATE
      `;
      if (rows.length === 0) return;
      const user = await tx.user.findUnique({ where: { id: userIdValue } });
      if (!user) return;
      const target = levels[this.resolveLevelIndex(levels, user.growthValue)];
      if (user.memberLevelId === target.id) return;

      await tx.user.update({
        where: { id: userIdValue },
        data: { memberLevelId: target.id },
      });
      await tx.userMemberRecord.create({
        data: {
          userId: userIdValue,
          oldLevelId: user.memberLevelId,
          newLevelId: target.id,
          changeReason: `成长值${user.growthValue}匹配会员等级${target.name}`,
        },
      });
    });
  }

  async addGrowthValue(userId: string, value: number, reason: string) {
    if (!Number.isSafeInteger(value) || value === 0) {
      throw new BadRequestException('成长值变更必须为非零整数');
    }
    const userIdValue = parsePositiveBigIntId(userId, '用户');
    const updated = await this.prisma.user.updateMany({
      where: {
        id: userIdValue,
        deletedAt: null,
        ...(value < 0 ? { growthValue: { gte: Math.abs(value) } } : {}),
      },
      data: { growthValue: { increment: value } },
    });
    if (updated.count === 0) throw new BadRequestException('用户不存在或成长值不足');
    await this.checkAndUpgradeLevel(userId);
    this.logger.log(`用户${userId}成长值变更${value}，原因：${reason}`);
  }

  private async getActiveLevels() {
    return this.prisma.memberLevel.findMany({
      where: { status: 1 },
      orderBy: [{ minGrowthValue: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  private resolveLevelIndex(levels: any[], growthValue: number) {
    let matched = -1;
    for (let index = 0; index < levels.length; index += 1) {
      const level = levels[index];
      if (
        growthValue >= level.minGrowthValue &&
        (level.maxGrowthValue === null || growthValue <= level.maxGrowthValue)
      ) {
        matched = index;
      }
    }
    if (matched >= 0) return matched;
    if (growthValue < levels[0].minGrowthValue) return 0;
    return levels.length - 1;
  }

  private async assertValidActiveLevelRanges() {
    const levels = await this.getActiveLevels();
    if (levels.length === 0) throw new BadRequestException('至少需要一个启用的会员等级');
    if (levels[0].minGrowthValue !== 0) throw new BadRequestException('第一个启用会员等级必须从成长值0开始');

    for (let index = 0; index < levels.length; index += 1) {
      const current = levels[index];
      if (current.maxGrowthValue !== null && current.maxGrowthValue < current.minGrowthValue) {
        throw new BadRequestException(`会员等级“${current.name}”最高成长值不能低于最低成长值`);
      }
      const next = levels[index + 1];
      if (!next) continue;
      if (current.maxGrowthValue === null) {
        throw new BadRequestException(`会员等级“${current.name}”不是最后一级，不能设置无上限`);
      }
      if (next.minGrowthValue !== current.maxGrowthValue + 1) {
        throw new BadRequestException(
          `会员等级区间必须连续且不重叠：“${current.name}”结束于${current.maxGrowthValue}，下一等级应从${current.maxGrowthValue + 1}开始`,
        );
      }
    }
    if (levels[levels.length - 1].maxGrowthValue !== null) {
      throw new BadRequestException('最后一个启用会员等级必须设置为无上限');
    }
  }

  private async reconcileAllUserLevels(reason: string) {
    const levels = await this.getActiveLevels();
    if (levels.length === 0) return;
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null },
      select: { id: true, growthValue: true, memberLevelId: true },
    });
    for (const user of users) {
      const target = levels[this.resolveLevelIndex(levels, user.growthValue)];
      if (user.memberLevelId === target.id) continue;
      await this.prisma.$transaction(async (tx) => {
        const claim = await tx.user.updateMany({
          where: { id: user.id, memberLevelId: user.memberLevelId },
          data: { memberLevelId: target.id },
        });
        if (claim.count === 0) return;
        await tx.userMemberRecord.create({
          data: {
            userId: user.id,
            oldLevelId: user.memberLevelId,
            newLevelId: target.id,
            changeReason: reason,
          },
        });
      });
    }
  }

  private serializeLevel(level: any, index: number) {
    const normalizedBenefits = this.getLevelBenefits(
      level.benefits,
      index,
      level.name,
      level.pointsRate,
    );
    return {
      ...level,
      id: level.id.toString(),
      level: index,
      discountRate: level.discountRate,
      pointsMultiplier: level.pointsRate / 10,
      benefits: JSON.stringify(normalizedBenefits),
      description: normalizedBenefits.map((benefit) => benefit.name).join('、'),
    };
  }

  private normalizeBenefits(raw: string | undefined, levelName: string, pointsRate: number) {
    if (raw && raw.trim()) {
      try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) throw new Error('not array');
        return JSON.stringify(parsed);
      } catch {
        throw new BadRequestException('会员权益必须是合法的 JSON 数组');
      }
    }
    return JSON.stringify(this.defaultBenefits(0, levelName, pointsRate));
  }

  private extractBenefitDescription(raw: string | null | undefined) {
    const benefits = this.parseBenefits(raw, 0);
    return benefits.map((benefit) => benefit.name).join('、');
  }

  private getLevelBenefits(benefitsJson: string | null | undefined, levelCode: number, levelName: string, pointsRate: number) {
    const parsed = this.parseBenefits(benefitsJson, levelCode);
    if (parsed.length > 0) return parsed;
    return this.defaultBenefits(levelCode, levelName, pointsRate);
  }

  private parseBenefits(benefitsJson: string | null | undefined, levelCode: number) {
    if (!benefitsJson) return [];
    try {
      const parsed = JSON.parse(benefitsJson);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((item) => item && typeof item === 'object' && item.name && item.description)
        .map((item, index) => {
          const id = String(item.id || `benefit_${levelCode}_${index + 1}`);
          const level = Number(item.level ?? levelCode);

          // Migrate only the IDs generated by our old defaults. Custom admin-configured benefit
          // cards are left untouched even when their display text happens to be similar.
          if (id.startsWith('priority_service_')) {
            return {
              id: id.replace('priority_service_', 'member_coupon_'),
              name: '会员专享券',
              icon: '/static/tab/activity.png',
              description: '可领取当前会员等级专属优惠券，具体以券中心可领取状态为准',
              level,
            };
          }
          if (id.startsWith('care_')) {
            return {
              id: id.replace('care_', 'auto_upgrade_'),
              name: '自动等级升级',
              icon: '/static/tab/user-active.png',
              description: '订单完成获得成长值，达到下一等级门槛后自动升级会员等级',
              level,
            };
          }

          return {
            id,
            name: String(item.name),
            icon: item.icon || '/static/default-cover.png',
            description: String(item.description),
            level,
          };
        });
    } catch {
      return [];
    }
  }

  private defaultBenefits(levelCode: number, levelName: string, pointsRate: number) {
    const pointsMultiplier = (pointsRate / 10).toFixed(1).replace(/\.0$/, '');
    return [
      {
        id: `member_price_${levelCode}`,
        name: '会员价',
        icon: '/static/tab/cart.png',
        description: `${levelName}普通商品按会员价结算，活动商品按活动规则结算`,
        level: levelCode,
      },
      {
        id: `points_growth_${levelCode}`,
        name: '积分成长',
        icon: '/static/tab/activity.png',
        description: `订单完成后可获得${pointsMultiplier}倍成长积分`,
        level: levelCode,
      },
      {
        id: `member_coupon_${levelCode}`,
        name: '会员专享券',
        icon: '/static/tab/activity.png',
        description: '可领取当前会员等级专属优惠券，具体以券中心可领取状态为准',
        level: levelCode,
      },
      {
        id: `auto_upgrade_${levelCode}`,
        name: '自动等级升级',
        icon: '/static/tab/user-active.png',
        description: '订单完成获得成长值，达到下一等级门槛后自动升级会员等级',
        level: levelCode,
      },
    ];
  }
}
