import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { UpdateMemberLevelDto } from './dto/update-member-level.dto';
import { MemberService } from './member.service';

const MEMBER_LEVEL_RECONCILE_REQUESTED = 'member_level_reconcile_requested';
const MEMBER_LEVEL_RECONCILE_PROGRESS = 'member_level_reconcile_progress';
const MEMBER_LEVEL_RECONCILE_COMPLETED = 'member_level_reconcile_completed';
const MEMBER_LEVEL_CONFIG_BIZ_TYPE = 'member_level_config';
const MEMBER_LEVEL_RECONCILE_BATCH_SIZE = 100;
const MEMBER_LEVEL_IMMEDIATE_RECONCILE_MAX_BATCHES = 1;

type ReconcileStatus = 'idle' | 'completed' | 'pending';

export interface MemberLevelReconcileResult {
  status: ReconcileStatus;
  generationId: string | null;
  batches: number;
  scanned: number;
  updated: number;
}

@Injectable()
export class AtomicMemberService extends MemberService {
  private readonly atomicLogger = new Logger(AtomicMemberService.name);

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
      await this.createMemberLevelReconcileRequest(tx, 'create', level.id);
      return level.id;
    });

    await this.reconcileCommittedConfigurationBestEffort();
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
      await this.createMemberLevelReconcileRequest(tx, 'update', levelId);
    });

    await this.reconcileCommittedConfigurationBestEffort();
    return super.findLevelById(id);
  }

  override async checkAndUpgradeLevel(userId: string) {
    const userIdValue = parsePositiveBigIntId(userId, '用户');

    await this.atomicPrisma.$transaction(async (tx) => {
      // Use the same lock order as configuration reconciliation: member-level configuration first,
      // then the user row. Whichever operation obtains the configuration lock second must observe
      // the newer rules, so an old growth-upgrade snapshot cannot overwrite a newer admin config.
      await this.lockMemberLevelConfiguration(tx);
      const levels = await tx.memberLevel.findMany({
        where: { status: 1 },
        orderBy: [{ minGrowthValue: 'asc' }, { sortOrder: 'asc' }],
      });
      if (levels.length === 0) return;

      const rows = await tx.$queryRaw<Array<{ id: bigint }>>`
        SELECT id
        FROM users
        WHERE id = ${userIdValue} AND deleted_at IS NULL
        FOR UPDATE
      `;
      if (rows.length === 0) return;

      const user = await tx.user.findUnique({ where: { id: userIdValue } });
      if (!user || user.deletedAt) return;
      const target = this.resolveTargetLevel(levels, user.growthValue);
      if (!target || user.memberLevelId === target.id) return;

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

  async reconcilePendingLevelConfiguration(
    maxBatches = Number.POSITIVE_INFINITY,
  ): Promise<MemberLevelReconcileResult> {
    if (!(maxBatches > 0)) {
      return { status: 'pending', generationId: null, batches: 0, scanned: 0, updated: 0 };
    }

    const initialRequest = await this.findLatestReconcileRequest(this.atomicPrisma);
    if (!initialRequest) {
      return { status: 'idle', generationId: null, batches: 0, scanned: 0, updated: 0 };
    }

    let generationId = initialRequest.id;
    let batches = 0;
    let scanned = 0;
    let updated = 0;

    while (batches < maxBatches) {
      const batch = await this.atomicPrisma.$transaction(async (tx) => {
        // Each batch holds the same configuration lock as admin mutations. A newer configuration
        // cannot commit while this batch is calculating targets from the current level ranges.
        await this.lockMemberLevelConfiguration(tx);

        const latestRequest = await this.findLatestReconcileRequest(tx);
        if (!latestRequest) {
          return { kind: 'idle' as const };
        }
        if (latestRequest.id !== generationId) {
          return {
            kind: 'superseded' as const,
            generationId: latestRequest.id,
          };
        }

        const completion = await tx.businessEvent.findFirst({
          where: {
            eventType: MEMBER_LEVEL_RECONCILE_COMPLETED,
            bizType: MEMBER_LEVEL_CONFIG_BIZ_TYPE,
            bizId: generationId.toString(),
          },
          select: { id: true },
        });
        if (completion) {
          return { kind: 'completed' as const, scanned: 0, updated: 0 };
        }

        // Cursor progress is durable and written in the same transaction as each full batch of
        // user updates. HTTP and cron workers therefore resume from the last committed user after
        // process crashes, and bounded cron runs do not repeatedly rescan the first N users.
        const progress = await tx.businessEvent.findFirst({
          where: {
            eventType: MEMBER_LEVEL_RECONCILE_PROGRESS,
            bizType: MEMBER_LEVEL_CONFIG_BIZ_TYPE,
            bizId: generationId.toString(),
          },
          orderBy: { id: 'desc' },
          select: { payload: true },
        });
        const cursor = this.parseReconcileCursor(progress?.payload);

        const levels = await tx.memberLevel.findMany({
          where: { status: 1 },
          orderBy: [{ minGrowthValue: 'asc' }, { sortOrder: 'asc' }],
        });
        if (levels.length === 0) {
          throw new BadRequestException('至少需要一个启用的会员等级');
        }

        const users = await tx.user.findMany({
          where: {
            deletedAt: null,
            id: { gt: cursor },
          },
          orderBy: { id: 'asc' },
          take: MEMBER_LEVEL_RECONCILE_BATCH_SIZE,
          select: { id: true, growthValue: true, memberLevelId: true },
        });

        let batchUpdated = 0;
        for (const user of users) {
          const target = this.resolveTargetLevel(levels, user.growthValue);
          if (!target || user.memberLevelId === target.id) continue;

          // growthValue is part of the CAS predicate. If an order changes growth after this batch
          // read, reconciliation must not assign a level calculated from the stale growth value;
          // checkAndUpgradeLevel() will converge that user using the latest config afterwards.
          const claim = await tx.user.updateMany({
            where: {
              id: user.id,
              deletedAt: null,
              growthValue: user.growthValue,
              memberLevelId: user.memberLevelId,
            },
            data: { memberLevelId: target.id },
          });
          if (claim.count !== 1) continue;

          batchUpdated += 1;
          await tx.userMemberRecord.create({
            data: {
              userId: user.id,
              oldLevelId: user.memberLevelId,
              newLevelId: target.id,
              changeReason: '会员等级配置变更',
            },
          });
        }

        const nextCursor = users.length > 0 ? users[users.length - 1].id : cursor;
        if (users.length < MEMBER_LEVEL_RECONCILE_BATCH_SIZE) {
          await tx.businessEvent.create({
            data: {
              eventType: MEMBER_LEVEL_RECONCILE_COMPLETED,
              bizType: MEMBER_LEVEL_CONFIG_BIZ_TYPE,
              bizId: generationId.toString(),
              level: 'info',
              message: '会员等级配置变更后的用户等级重算已完成',
              payload: {
                generationId: generationId.toString(),
                cursor: nextCursor.toString(),
              },
            },
          });
          return {
            kind: 'completed' as const,
            scanned: users.length,
            updated: batchUpdated,
          };
        }

        await tx.businessEvent.create({
          data: {
            eventType: MEMBER_LEVEL_RECONCILE_PROGRESS,
            bizType: MEMBER_LEVEL_CONFIG_BIZ_TYPE,
            bizId: generationId.toString(),
            level: 'info',
            message: '会员等级配置变更后的用户等级重算批次已完成',
            payload: {
              generationId: generationId.toString(),
              cursor: nextCursor.toString(),
            },
          },
        });

        return {
          kind: 'continue' as const,
          scanned: users.length,
          updated: batchUpdated,
        };
      });

      batches += 1;
      if (batch.kind === 'idle') {
        return { status: 'idle', generationId: null, batches, scanned, updated };
      }
      if (batch.kind === 'superseded') {
        generationId = batch.generationId;
        scanned = 0;
        updated = 0;
        continue;
      }

      scanned += batch.scanned;
      updated += batch.updated;
      if (batch.kind === 'completed') {
        return {
          status: 'completed',
          generationId: generationId.toString(),
          batches,
          scanned,
          updated,
        };
      }
    }

    return {
      status: 'pending',
      generationId: generationId.toString(),
      batches,
      scanned,
      updated,
    };
  }

  private async reconcileCommittedConfigurationBestEffort() {
    try {
      const result = await this.reconcilePendingLevelConfiguration(
        MEMBER_LEVEL_IMMEDIATE_RECONCILE_MAX_BATCHES,
      );
      if (result.status === 'pending') {
        this.atomicLogger.log(
          `会员等级配置已提交并完成首批重算，剩余用户将由定时任务继续处理：generation=${result.generationId}, scanned=${result.scanned}, updated=${result.updated}`,
        );
      }
    } catch (error) {
      // The configuration transaction has already committed. Do not turn a successful admin
      // mutation into a false failure that may be retried as a duplicate create. The durable
      // request event lets the scheduler resume the same reconciliation generation later.
      this.atomicLogger.error(
        `会员等级配置已提交，但即时用户等级重算失败，将由定时任务补偿：${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }

  private async createMemberLevelReconcileRequest(
    tx: Prisma.TransactionClient,
    action: 'create' | 'update',
    levelId: bigint,
  ) {
    return tx.businessEvent.create({
      data: {
        eventType: MEMBER_LEVEL_RECONCILE_REQUESTED,
        bizType: MEMBER_LEVEL_CONFIG_BIZ_TYPE,
        bizId: levelId.toString(),
        level: 'info',
        message: '会员等级配置已变更，需要重新匹配用户等级',
        payload: {
          action,
          levelId: levelId.toString(),
        },
      },
    });
  }

  private async findLatestReconcileRequest(client: any) {
    return client.businessEvent.findFirst({
      where: {
        eventType: MEMBER_LEVEL_RECONCILE_REQUESTED,
        bizType: MEMBER_LEVEL_CONFIG_BIZ_TYPE,
      },
      orderBy: { id: 'desc' },
      select: { id: true },
    }) as Promise<{ id: bigint } | null>;
  }

  private parseReconcileCursor(payload: unknown): bigint {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return 0n;
    const raw = (payload as Record<string, unknown>).cursor;
    if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return 0n;
    try {
      return BigInt(raw);
    } catch {
      return 0n;
    }
  }

  private async lockMemberLevelConfiguration(tx: Prisma.TransactionClient) {
    // All member-level mutations, growth upgrades, and reconcile batches take these locks first.
    // This prevents a valid-on-its-own edit or stale runtime snapshot from committing against a
    // different level layout. On an empty table InnoDB also protects the scanned key range.
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
