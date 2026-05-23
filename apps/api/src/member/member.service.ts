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

    return {
      growthValue: user.growthValue,
      currentLevel: currentLevelConfig.name,
      currentLevelCode: levelCode,
      discountRate: currentLevelConfig.discountRate,
      pointsRate: currentLevelConfig.pointsRate,
      nextLevel: nextLevelConfig ? nextLevelConfig.name : null,
      nextLevelGrowth: nextLevelConfig ? nextLevelConfig.minGrowth : null,
      growthGap: nextLevelConfig ? nextLevelConfig.minGrowth - user.growthValue : 0,
      memberLevel: user.memberLevel ? { ...user.memberLevel, id: user.memberLevel.id.toString() } : null,
    };
  }

  async getBenefits(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: BigInt(userId), deletedAt: null },
    });
    if (!user) throw new NotFoundException('用户不存在');

    const levelCode = getMemberLevelByGrowth(user.growthValue);
    const currentLevelConfig = MEMBER_LEVELS[levelCode];

    const benefits: any[] = [];

    if (currentLevelConfig.discountRate) {
      benefits.push({
        type: 'discount',
        name: `${currentLevelConfig.name}专属折扣`,
        description: `享受${(currentLevelConfig.discountRate / 10).toFixed(1).replace(/\.0$/, '')}折优惠`,
        value: currentLevelConfig.discountRate,
      });
    }

    benefits.push({
      type: 'points_rate',
      name: `${currentLevelConfig.pointsRate}倍积分加速`,
      description: `消费可获得${currentLevelConfig.pointsRate}倍积分`,
      value: currentLevelConfig.pointsRate,
    });

    const level = await this.prisma.memberLevel.findFirst({
      where: { status: 1, sortOrder: levelCode },
    });

    if (level?.benefits) {
      try {
        const extraBenefits = JSON.parse(level.benefits as string);
        if (Array.isArray(extraBenefits)) {
          benefits.push(...extraBenefits);
        }
      } catch {}
    }

    return { levelCode, levelName: currentLevelConfig.name, benefits };
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
}
