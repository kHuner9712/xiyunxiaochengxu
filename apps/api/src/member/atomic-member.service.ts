import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { UpdateMemberLevelDto } from './dto/update-member-level.dto';
import { MemberService } from './member.service';

@Injectable()
export class AtomicMemberService extends MemberService {
  constructor(private readonly atomicPrisma: PrismaService) {
    super(atomicPrisma);
  }

  override async createLevel(dto: UpdateMemberLevelDto) {
    if (!dto.name || dto.minGrowthValue === undefined) {
      throw new BadRequestException('新增会员等级必须填写名称和最低成长值');
    }
    const normalizeBenefits = (this as any).normalizeBenefits as (
      raw: string | undefined,
      levelName: string,
      pointsRate: number,
    ) => string;
    const benefits = normalizeBenefits.call(
      this,
      dto.benefits,
      dto.name,
      dto.pointsRate ?? 10,
    );

    const levelId = await this.atomicPrisma.$transaction(async (tx) => {
      await this.lockMemberLevelConfiguration(tx);
      const level = await tx.memberLevel.create({
        data: {
          name: dto.name!.trim(),
          icon: dto.icon || null,
          minGrowthValue: dto.minGrowthValue!,
          maxGrowthValue: dto.maxGrowthValue ?? null,
          discountRate: dto.discountRate ?? null,
          pointsRate: dto.pointsRate ?? 10,
          benefits,
          sortOrder: dto.sortOrder ?? dto.minGrowthValue!,
          status: dto.status ?? 1,
        },
      });
      await this.assertValidActiveLevelRangesInTransaction(tx);
      return level.id;
    });

    await this.reconcileUsersAfterLevelChange();
    return super.findLevelById(levelId.toString());
  }

  override async updateLevel(id: string, dto: UpdateMemberLevelDto) {
    const levelId = parsePositiveBigIntId(id, '会员等级');

    await this.atomicPrisma.$transaction(async (tx) => {
      await this.lockMemberLevelConfiguration(tx);
      const current = await tx.memberLevel.findUnique({ where: { id: levelId } });
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
        const normalizeBenefits = (this as any).normalizeBenefits as (
          raw: string | undefined,
          levelName: string,
          pointsRate: number,
        ) => string;
        data.benefits = normalizeBenefits.call(
          this,
          dto.benefits,
          dto.name ?? current.name,
          dto.pointsRate ?? current.pointsRate,
        );
      }

      await tx.memberLevel.update({ where: { id: levelId }, data });
      await this.assertValidActiveLevelRangesInTransaction(tx);
    });

    await this.reconcileUsersAfterLevelChange();
    return super.findLevelById(id);
  }

  private async lockMemberLevelConfiguration(tx: Prisma.TransactionClient) {
    // All admin member-level mutations take the same ordered row locks. This prevents two valid-on-
    // their-own edits from committing an invalid combined range layout under concurrent requests.
    await tx.$queryRaw`
      SELECT id
      FROM member_levels
      ORDER BY id
      FOR UPDATE
    `;
  }

  private async assertValidActiveLevelRangesInTransaction(tx: Prisma.TransactionClient) {
    const levels = await tx.memberLevel.findMany({
      where: { status: 1 },
      orderBy: [{ minGrowthValue: 'asc' }, { sortOrder: 'asc' }],
    });
    if (levels.length === 0) throw new BadRequestException('至少需要一个启用的会员等级');
    if (levels[0].minGrowthValue !== 0) {
      throw new BadRequestException('第一个启用会员等级必须从成长值0开始');
    }

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

  private async reconcileUsersAfterLevelChange() {
    const levels = await this.atomicPrisma.memberLevel.findMany({
      where: { status: 1 },
      orderBy: [{ minGrowthValue: 'asc' }, { sortOrder: 'asc' }],
    });
    if (levels.length === 0) return;

    const users = await this.atomicPrisma.user.findMany({
      where: { deletedAt: null },
      select: { id: true, growthValue: true, memberLevelId: true },
    });

    for (const user of users) {
      const target = this.resolveTargetLevel(levels, user.growthValue);
      if (!target || user.memberLevelId === target.id) continue;

      await this.atomicPrisma.$transaction(async (tx) => {
        const claim = await tx.user.updateMany({
          where: {
            id: user.id,
            deletedAt: null,
            memberLevelId: user.memberLevelId,
          },
          data: { memberLevelId: target.id },
        });
        if (claim.count !== 1) return;

        await tx.userMemberRecord.create({
          data: {
            userId: user.id,
            oldLevelId: user.memberLevelId,
            newLevelId: target.id,
            changeReason: '会员等级配置变更',
          },
        });
      });
    }
  }

  private resolveTargetLevel(levels: any[], growthValue: number) {
    let matched = -1;
    for (let index = 0; index < levels.length; index += 1) {
      const level = levels[index];
      if (
        growthValue >= level.minGrowthValue
        && (level.maxGrowthValue === null || growthValue <= level.maxGrowthValue)
      ) {
        matched = index;
      }
    }
    if (matched >= 0) return levels[matched];
    if (growthValue < levels[0].minGrowthValue) return levels[0];
    return levels[levels.length - 1];
  }
}
