import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { getMemberLevelByGrowth, MEMBER_LEVELS } from '@baby-mall/shared';

@Injectable()
export class MemberService {
  private readonly logger = new Logger(MemberService.name);

  constructor(private prisma: PrismaService) {}

  async findAllLevels() {
    const levels = await this.prisma.memberLevel.findMany({
      where: { status: 1 },
      orderBy: { sortOrder: 'asc' },
    });
    return levels.map((l) => ({
      ...l,
      id: l.id.toString(),
    }));
  }

  async getMemberInfo(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: BigInt(userId), deletedAt: null },
      include: { memberLevel: true },
    });
    if (!user) throw new NotFoundException('用户不存在');

    const levelCode = getMemberLevelByGrowth(user.growthValue);
    const currentLevelConfig = MEMBER_LEVELS[levelCode];
    const nextLevelConfig = MEMBER_LEVELS[levelCode + 1];
    const nextLevelGrowth = nextLevelConfig?.minGrowth ?? user.growthValue;
    const rights = this.getLevelBenefits(user.memberLevel?.benefits, levelCode, currentLevelConfig.name, currentLevelConfig.pointsRate);

    return {
      level: levelCode,
      levelName: currentLevelConfig.name,
      growthValue: user.growthValue,
      currentLevelGrowth: user.growthValue,
      nextLevelGrowth,
      rights: rights.map((right) => right.name),
      currentLevel: currentLevelConfig.name,
      currentLevelCode: levelCode,
      discountRate: currentLevelConfig.discountRate,
      pointsRate: currentLevelConfig.pointsRate,
      nextLevel: nextLevelConfig ? nextLevelConfig.name : null,
      growthGap: nextLevelConfig ? nextLevelConfig.minGrowth - user.growthValue : 0,
      memberLevel: user.memberLevel ? { ...user.memberLevel, id: user.memberLevel.id.toString() } : null,
    };
  }

  async getBenefits(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: BigInt(userId), deletedAt: null },
      include: { memberLevel: true },
    });
    if (!user) throw new NotFoundException('用户不存在');

    const levelCode = getMemberLevelByGrowth(user.growthValue);
    const currentLevelConfig = MEMBER_LEVELS[levelCode];
    const benefits = this.getLevelBenefits(
      user.memberLevel?.benefits,
      levelCode,
      currentLevelConfig.name,
      currentLevelConfig.pointsRate,
    );

    return benefits;
  }

  async findLevelById(id: string) {
    const level = await this.prisma.memberLevel.findFirst({ where: { id: BigInt(id) } });
    if (!level) throw new NotFoundException('会员等级不存在');
    return { ...level, id: level.id.toString() };
  }

  async createLevel(data: any) {
    const level = await this.prisma.memberLevel.create({ data });
    this.logger.log(`创建会员等级：${level.id}`);
    return { ...level, id: level.id.toString() };
  }

  async updateLevel(id: string, data: any) {
    const level = await this.prisma.memberLevel.findFirst({ where: { id: BigInt(id) } });
    if (!level) throw new NotFoundException('会员等级不存在');

    const result = await this.prisma.memberLevel.update({
      where: { id: BigInt(id) },
      data,
    });
    this.logger.log(`更新会员等级：${id}`);
    return { ...result, id: result.id.toString() };
  }

  async checkAndUpgradeLevel(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: BigInt(userId), deletedAt: null },
    });
    if (!user) return;

    const expectedLevelCode = getMemberLevelByGrowth(user.growthValue);
    const levels = await this.prisma.memberLevel.findMany({
      where: { status: 1 },
      orderBy: { sortOrder: 'asc' },
    });

    const targetLevel = levels[expectedLevelCode];
    if (!targetLevel) return;

    if (!user.memberLevelId || user.memberLevelId !== targetLevel.id) {
      await this.prisma.user.update({
        where: { id: BigInt(userId) },
        data: { memberLevelId: targetLevel.id },
      });

      await this.prisma.userMemberRecord.create({
        data: {
          userId: BigInt(userId),
          oldLevelId: user.memberLevelId,
          newLevelId: targetLevel.id,
          changeReason: `成长值达到${user.growthValue}自动升级`,
        },
      });

      this.logger.log(`用户${userId}升级为${targetLevel.name}`);
    }
  }

  async addGrowthValue(userId: string, value: number, reason: string) {
    await this.prisma.user.update({
      where: { id: BigInt(userId) },
      data: { growthValue: { increment: value } },
    });
    await this.checkAndUpgradeLevel(userId);
    this.logger.log(`用户${userId}增加成长值${value}，原因：${reason}`);
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
        .map((item, index) => ({
          id: item.id || `benefit_${levelCode}_${index + 1}`,
          name: String(item.name),
          icon: item.icon || '/static/default-cover.png',
          description: String(item.description),
          level: Number(item.level ?? levelCode),
        }));
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
        description: `${levelName}可查看会员专享价与活动价`,
        level: levelCode,
      },
      {
        id: `points_growth_${levelCode}`,
        name: '积分成长',
        icon: '/static/tab/activity.png',
        description: `消费可获得${pointsMultiplier}倍成长积分`,
        level: levelCode,
      },
      {
        id: `priority_service_${levelCode}`,
        name: '售后优先',
        icon: '/static/tab/user-active.png',
        description: '售后咨询与处理优先响应',
        level: levelCode,
      },
      {
        id: `care_${levelCode}`,
        name: '生日/孕产期关怀',
        icon: '/static/default-baby.png',
        description: '按宝宝生日或孕产阶段推送关怀福利',
        level: levelCode,
      },
    ];
  }
}
