import { createHash } from 'crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { MerchantSettlementService } from '../merchant-settlement/merchant-settlement.service';
import { ValiditySafeSnapshotViewBenefitPackageService } from './validity-safe-snapshot-view-benefit-package.service';

export const BENEFIT_PACKAGE_CREATE_EVENT = 'benefit_package_create';
const BENEFIT_PACKAGE_BIZ_TYPE = 'benefit_package';
const SERIALIZABLE_RETRY_LIMIT = 3;

type VersionedCreateInternals = {
  lockAndAssertProduct(tx: Prisma.TransactionClient, productId: bigint): Promise<void>;
  recordProductConfigBeforeChange(
    tx: Prisma.TransactionClient,
    productId: bigint,
    reason: string,
  ): Promise<void>;
  buildPackageCreateData(
    data: any,
    productId: bigint | null,
  ): Prisma.BenefitPackageUncheckedCreateInput;
  syncItemsInTransaction(
    tx: Prisma.TransactionClient,
    packageId: bigint,
    items: any[],
  ): Promise<void>;
};

@Injectable()
export class DurableAdminBenefitPackageService extends ValiditySafeSnapshotViewBenefitPackageService {
  private readonly durableLogger = new Logger(DurableAdminBenefitPackageService.name);

  constructor(
    private readonly durablePrisma: PrismaService,
    merchantSettlementService: MerchantSettlementService,
  ) {
    super(durablePrisma, merchantSettlementService);
  }

  override async create(data: any) {
    const requestId = String(data?.clientRequestId ?? '').trim() || null;
    const productId = data?.productId
      ? parsePositiveBigIntId(String(data.productId), '商品')
      : null;
    const fingerprint = this.createFingerprint(data, productId);
    const internals = this as unknown as VersionedCreateInternals;

    for (let attempt = 0; attempt < SERIALIZABLE_RETRY_LIMIT; attempt += 1) {
      try {
        const packageId = await this.durablePrisma.$transaction(
          async (tx) => {
            if (requestId) {
              const handled = await tx.businessEvent.findFirst({
                where: {
                  eventType: BENEFIT_PACKAGE_CREATE_EVENT,
                  bizType: BENEFIT_PACKAGE_BIZ_TYPE,
                  bizId: requestId,
                },
                orderBy: { id: 'desc' },
              });
              if (handled) {
                const payload = this.readCreateEventPayload(handled.payload);
                if (payload.fingerprint !== fingerprint) {
                  throw new BadRequestException('权益包创建请求ID已被其他操作使用，请重新提交');
                }
                const replayId = parsePositiveBigIntId(payload.packageId, '权益包');
                const replay = await tx.benefitPackage.findFirst({
                  where: { id: replayId, deletedAt: null },
                  select: { id: true },
                });
                if (!replay) {
                  throw new BadRequestException('该权益包创建请求已处理，但权益包已不存在，请刷新列表');
                }
                return replay.id;
              }
            }

            if (productId) {
              await internals.lockAndAssertProduct(tx, productId);
              await internals.recordProductConfigBeforeChange(tx, productId, '创建权益包');
              await tx.benefitPackage.updateMany({
                where: { productId, deletedAt: { not: null } },
                data: { productId: null },
              });
              const conflict = await tx.benefitPackage.findFirst({
                where: { productId, deletedAt: null },
                select: { id: true },
              });
              if (conflict) throw new BadRequestException(`商品已绑定权益包：${conflict.id}`);
            }

            const pkg = await tx.benefitPackage.create({
              data: internals.buildPackageCreateData(data, productId),
            });
            if (Array.isArray(data?.items)) {
              await internals.syncItemsInTransaction(tx, pkg.id, data.items);
            }
            if (requestId) {
              await tx.businessEvent.create({
                data: {
                  eventType: BENEFIT_PACKAGE_CREATE_EVENT,
                  bizType: BENEFIT_PACKAGE_BIZ_TYPE,
                  bizId: requestId,
                  level: 'info',
                  message: '权益包创建请求已处理',
                  payload: {
                    packageId: pkg.id.toString(),
                    fingerprint,
                  } as Prisma.InputJsonValue,
                },
              });
            }
            return pkg.id;
          },
          { isolationLevel: 'Serializable' },
        );
        this.durableLogger.log(`创建权益包：${packageId}`);
        return this.findById(packageId.toString());
      } catch (error: any) {
        if (error?.code === 'P2034' && attempt + 1 < SERIALIZABLE_RETRY_LIMIT) continue;
        throw error;
      }
    }

    throw new Error('权益包创建事务重试次数已耗尽');
  }

  override async delete(id: string) {
    parsePositiveBigIntId(id, '权益包');
    try {
      return await super.delete(id);
    } catch (error) {
      if (!(error instanceof NotFoundException)) throw error;
      const existing = await this.durablePrisma.benefitPackage.findUnique({
        where: { id: BigInt(id) },
        select: { deletedAt: true },
      });
      if (existing?.deletedAt) return { id };
      throw error;
    }
  }

  private createFingerprint(data: any, productId: bigint | null) {
    const normalizeString = (value: unknown) => {
      if (value === undefined || value === null || value === '') return null;
      return String(value).trim();
    };
    const normalizeDate = (value: unknown) => {
      const text = normalizeString(value);
      if (!text) return null;
      const date = new Date(text);
      return Number.isFinite(date.getTime()) ? date.toISOString() : text;
    };
    const normalizeNumber = (value: unknown) => {
      if (value === undefined || value === null || value === '') return null;
      return Number(value);
    };
    const items = Array.isArray(data?.items)
      ? data.items.map((item: any) => ({
          id: normalizeString(item?.id),
          merchantPromotionSourceId: normalizeString(item?.merchantPromotionSourceId),
          pickupStoreId: normalizeString(item?.pickupStoreId),
          name: normalizeString(item?.name),
          itemType: normalizeString(item?.itemType),
          description: normalizeString(item?.description),
          quantity: normalizeNumber(item?.quantity),
          originalValue: normalizeNumber(item?.originalValue),
          verifyRequired: normalizeNumber(item?.verifyRequired),
          status: normalizeNumber(item?.status),
          sortOrder: normalizeNumber(item?.sortOrder),
        }))
      : null;
    const normalized = {
      productId: productId?.toString() ?? null,
      name: normalizeString(data?.name),
      subtitle: normalizeString(data?.subtitle),
      coverImage: normalizeString(data?.coverImage),
      description: normalizeString(data?.description),
      price: normalizeNumber(data?.price),
      validDays: normalizeNumber(data?.validDays),
      validStartAt: normalizeDate(data?.validStartAt),
      validEndAt: normalizeDate(data?.validEndAt),
      status: normalizeNumber(data?.status),
      sortOrder: normalizeNumber(data?.sortOrder),
      items,
    };
    return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
  }

  private readCreateEventPayload(payload: unknown) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new BadRequestException('权益包创建幂等记录损坏，请刷新列表后重试');
    }
    const record = payload as Record<string, unknown>;
    const packageId = String(record.packageId ?? '').trim();
    const fingerprint = String(record.fingerprint ?? '').trim();
    if (!packageId || !fingerprint) {
      throw new BadRequestException('权益包创建幂等记录损坏，请刷新列表后重试');
    }
    return { packageId, fingerprint };
  }
}
