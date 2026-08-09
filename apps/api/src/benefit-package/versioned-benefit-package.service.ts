import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import { MerchantSettlementService } from '../merchant-settlement/merchant-settlement.service';
import { ProductionMerchantSettlementService } from '../merchant-settlement/production-merchant-settlement.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { ZeroPayAwareBenefitPackageService } from './zero-pay-aware-benefit-package.service';

const CONFIG_VERSION_EVENT = 'benefit_product_config_before_change';
const ORDER_ITEM_SNAPSHOT_EVENT = 'benefit_order_item_snapshot';
const USER_PACKAGE_SNAPSHOT_EVENT = 'benefit_user_package_snapshot';
const ENTITLEMENT_SNAPSHOT_EVENT = 'benefit_entitlement_snapshot';
const CONFIG_BIZ_TYPE = 'benefit_product_config';
const ORDER_ITEM_BIZ_TYPE = 'benefit_order_item';
const USER_PACKAGE_BIZ_TYPE = 'benefit_user_package';
const ENTITLEMENT_BIZ_TYPE = 'benefit_entitlement';
const VERIFY_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const VERIFY_CODE_LENGTH = 8;

type DbClient = PrismaService | Prisma.TransactionClient;

type BenefitItemSnapshot = {
  id: string;
  merchantPromotionSourceId: string | null;
  pickupStoreId: string | null;
  name: string;
  itemType: string;
  description: string | null;
  quantity: number;
  originalValue: number | null;
  verifyRequired: number;
  status: number;
  sortOrder: number;
};

type BenefitPackageSnapshot = {
  id: string;
  productId: string | null;
  name: string;
  subtitle: string | null;
  coverImage: string | null;
  description: string | null;
  price: number | null;
  validDays: number | null;
  validStartAt: string | null;
  validEndAt: string | null;
  status: number;
  sortOrder: number;
  items: BenefitItemSnapshot[];
};

type ProductBenefitSnapshot = {
  version: 1;
  productId: string;
  package: BenefitPackageSnapshot | null;
};

function cleanId(value: unknown, label: string): bigint | null {
  if (value === undefined || value === null || value === '') return null;
  return parsePositiveBigIntId(String(value), label);
}

function optionalInt(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new BadRequestException('数值参数无效');
  return parsed;
}

@Injectable()
export class VersionedBenefitPackageService extends ZeroPayAwareBenefitPackageService {
  private readonly versionLogger = new Logger(VersionedBenefitPackageService.name);

  constructor(
    private readonly versionPrisma: PrismaService,
    private readonly versionSettlementService: MerchantSettlementService,
  ) {
    super(versionPrisma, versionSettlementService);
  }

  override async create(data: any) {
    const productId = cleanId(data.productId, '商品');
    const packageId = await this.versionPrisma.$transaction(async (tx) => {
      if (productId) {
        await this.lockAndAssertProduct(tx, productId);
        await this.recordProductConfigBeforeChange(tx, productId, '创建权益包');
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
        data: this.buildPackageCreateData(data, productId),
      });
      if (Array.isArray(data.items)) {
        await this.syncItemsInTransaction(tx, pkg.id, data.items);
      }
      return pkg.id;
    });
    this.versionLogger.log(`创建权益包：${packageId}`);
    return this.findById(packageId.toString());
  }

  override async update(id: string, data: any) {
    const packageId = parsePositiveBigIntId(id, '权益包');
    await this.versionPrisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM benefit_packages WHERE id = ${packageId} FOR UPDATE`;
      const pkg = await tx.benefitPackage.findFirst({
        where: { id: packageId, deletedAt: null },
      });
      if (!pkg) throw new NotFoundException('权益包不存在');

      const nextProductId = data.productId !== undefined
        ? cleanId(data.productId, '商品')
        : pkg.productId;
      const affectedProductIds = new Set<string>();
      if (pkg.productId) affectedProductIds.add(pkg.productId.toString());
      if (nextProductId) affectedProductIds.add(nextProductId.toString());
      const sortedProductIds = [...affectedProductIds].sort((a, b) => BigInt(a) < BigInt(b) ? -1 : 1);
      for (const productIdText of sortedProductIds) {
        const productId = BigInt(productIdText);
        await this.lockAndAssertProduct(tx, productId);
        await this.recordProductConfigBeforeChange(tx, productId, `更新权益包${packageId}`);
      }

      if (nextProductId) {
        await tx.benefitPackage.updateMany({
          where: {
            productId: nextProductId,
            deletedAt: { not: null },
            id: { not: packageId },
          },
          data: { productId: null },
        });
        const conflict = await tx.benefitPackage.findFirst({
          where: {
            productId: nextProductId,
            deletedAt: null,
            id: { not: packageId },
          },
          select: { id: true },
        });
        if (conflict) throw new BadRequestException(`商品已绑定权益包：${conflict.id}`);
      }

      const updateData = this.buildPackageUpdateData(data, nextProductId, data.productId !== undefined);
      if (Object.keys(updateData).length > 0) {
        await tx.benefitPackage.update({ where: { id: packageId }, data: updateData });
      }
      if (Array.isArray(data.items)) {
        await this.syncItemsInTransaction(tx, packageId, data.items);
      }
    });
    this.versionLogger.log(`更新权益包：${id}`);
    return this.findById(id);
  }

  override async updateStatus(id: string, status: number) {
    if (status !== 0 && status !== 1) throw new BadRequestException('权益包状态无效');
    const packageId = parsePositiveBigIntId(id, '权益包');
    await this.versionPrisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM benefit_packages WHERE id = ${packageId} FOR UPDATE`;
      const pkg = await tx.benefitPackage.findFirst({
        where: { id: packageId, deletedAt: null },
      });
      if (!pkg) throw new NotFoundException('权益包不存在');
      if (pkg.productId) {
        await this.lockAndAssertProduct(tx, pkg.productId);
        await this.recordProductConfigBeforeChange(tx, pkg.productId, `变更权益包${packageId}状态`);
      }
      await tx.benefitPackage.update({ where: { id: packageId }, data: { status } });
    });
    this.versionLogger.log(`更新权益包状态：${id} -> ${status}`);
    return this.findById(id);
  }

  override async delete(id: string) {
    const packageId = parsePositiveBigIntId(id, '权益包');
    await this.versionPrisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM benefit_packages WHERE id = ${packageId} FOR UPDATE`;
      const pkg = await tx.benefitPackage.findFirst({
        where: { id: packageId, deletedAt: null },
      });
      if (!pkg) throw new NotFoundException('权益包不存在');
      if (pkg.productId) {
        await this.lockAndAssertProduct(tx, pkg.productId);
        await this.recordProductConfigBeforeChange(tx, pkg.productId, `删除权益包${packageId}`);
      }
      const deletedAt = new Date();
      await tx.benefitPackageItem.updateMany({
        where: { packageId, deletedAt: null },
        data: { deletedAt },
      });
      await tx.benefitPackage.update({
        where: { id: packageId },
        data: { deletedAt, status: 0, productId: null },
      });
    });
    this.versionLogger.log(`删除权益包：${id}`);
    return { id };
  }

  override async grantBenefitsForOrder(orderId: string | bigint, userId: string | bigint) {
    await this.ensureOrderBenefits(orderId, userId);
  }

  override async reconcileOrderBenefits(orderId: string | bigint, userId: string | bigint) {
    await this.ensureOrderBenefits(orderId, userId);
  }

  override async previewVerify(verifyCode: string) {
    const code = String(verifyCode || '').trim().toUpperCase();
    if (!code) throw new BadRequestException('核销码不能为空');
    const entitlement = await this.versionPrisma.userBenefitEntitlement.findFirst({
      where: { verifyCode: code, deletedAt: null },
    });
    if (!entitlement) throw new NotFoundException('权益码不存在');

    const [userPkg, user] = await Promise.all([
      this.versionPrisma.userBenefitPackage.findFirst({
        where: { id: entitlement.userBenefitPackageId, deletedAt: null },
      }),
      this.versionPrisma.user.findFirst({
        where: { id: entitlement.userId },
        select: { id: true, nickname: true, phone: true },
      }),
    ]);
    if (!userPkg) throw new BadRequestException('权益包不存在');
    const resolved = await this.resolveEntitlementSnapshot(
      this.versionPrisma,
      entitlement,
      userPkg,
      false,
    );
    const item = resolved.item;
    const pkg = resolved.package;
    const [merchant, store] = await Promise.all([
      item?.merchantPromotionSourceId
        ? this.versionPrisma.merchantPromotionSource.findFirst({
            where: { id: BigInt(item.merchantPromotionSourceId) },
          })
        : null,
      item?.pickupStoreId
        ? this.versionPrisma.pickupStore.findFirst({
            where: { id: BigInt(item.pickupStoreId) },
          })
        : null,
    ]);

    const now = new Date();
    let canVerify = true;
    let reason = '';
    if (entitlement.status !== 'unused') {
      canVerify = false;
      reason = entitlement.status === 'used' ? '该权益已被核销' : `权益状态为${entitlement.status}`;
    } else if (userPkg.status !== 'active') {
      canVerify = false;
      reason = `权益包状态为${userPkg.status}`;
    } else if (userPkg.validFrom && userPkg.validFrom > now) {
      canVerify = false;
      reason = '权益尚未生效';
    } else if (userPkg.validTo && userPkg.validTo < now) {
      canVerify = false;
      reason = '权益已过期';
    } else if (!item) {
      canVerify = false;
      reason = '权益项快照不存在';
    } else if (item.verifyRequired !== 1) {
      canVerify = false;
      reason = '该权益项无需核销';
    }

    return {
      entitlementId: entitlement.id,
      verifyCode: code,
      status: entitlement.status,
      usedAt: entitlement.usedAt,
      userId: entitlement.userId,
      nickname: user?.nickname ?? null,
      phone: user?.phone ?? null,
      packageId: userPkg.packageId,
      packageName: pkg?.name ?? null,
      packageItemId: entitlement.packageItemId,
      itemName: item?.name ?? null,
      itemType: item?.itemType ?? null,
      originalValue: item?.originalValue ?? null,
      validFrom: userPkg.validFrom,
      validTo: userPkg.validTo,
      merchantName: merchant?.name ?? null,
      merchantContactPhone: merchant?.contactPhone ?? null,
      storeName: store?.name ?? null,
      storeAddress: store
        ? `${store.province}${store.city}${store.district}${store.address}`
        : null,
      canVerify,
      reason,
    };
  }

  override async verify(verifyCode: string, adminId: string, remark?: string) {
    const code = String(verifyCode || '').trim().toUpperCase();
    if (!code) throw new BadRequestException('核销码不能为空');
    const verifierId = parsePositiveBigIntId(adminId, '管理员');

    return this.versionPrisma.$transaction(async (tx) => {
      const entitlement = await tx.userBenefitEntitlement.findFirst({
        where: { verifyCode: code, deletedAt: null },
      });
      if (!entitlement) throw new NotFoundException('权益码不存在');
      await tx.$queryRaw`
        SELECT id FROM user_benefit_entitlements WHERE id = ${entitlement.id} FOR UPDATE
      `;
      const lockedEntitlement = await tx.userBenefitEntitlement.findUnique({
        where: { id: entitlement.id },
      });
      if (!lockedEntitlement || lockedEntitlement.deletedAt) throw new NotFoundException('权益码不存在');
      if (lockedEntitlement.status === 'used') throw new BadRequestException('该权益已被核销，请勿重复核销');
      if (lockedEntitlement.status !== 'unused') {
        throw new BadRequestException(`权益状态为${lockedEntitlement.status}，不可核销`);
      }

      const userPkg = await tx.userBenefitPackage.findFirst({
        where: { id: lockedEntitlement.userBenefitPackageId, deletedAt: null },
      });
      if (!userPkg) throw new BadRequestException('权益包不存在');
      if (userPkg.status !== 'active') throw new BadRequestException(`权益包状态为${userPkg.status}，不可核销`);
      const now = new Date();
      if (userPkg.validFrom && userPkg.validFrom > now) throw new BadRequestException('权益尚未生效，不可核销');
      if (userPkg.validTo && userPkg.validTo < now) throw new BadRequestException('权益已过期，不可核销');

      const resolved = await this.resolveEntitlementSnapshot(tx, lockedEntitlement, userPkg, true);
      const item = resolved.item;
      if (!item) throw new BadRequestException('权益项快照不存在');
      if (item.verifyRequired !== 1) throw new BadRequestException('该权益项无需核销');

      const claim = await tx.userBenefitEntitlement.updateMany({
        where: { id: lockedEntitlement.id, status: 'unused' },
        data: {
          status: 'used',
          usedAt: now,
          verifiedByAdminId: verifierId,
          verifyRemark: remark ?? null,
        },
      });
      if (claim.count !== 1) throw new BadRequestException('核销失败：该权益可能已被其他操作核销');

      const verificationLog = await tx.userBenefitVerificationLog.create({
        data: {
          entitlementId: lockedEntitlement.id,
          userId: lockedEntitlement.userId,
          packageId: userPkg.packageId,
          packageItemId: lockedEntitlement.packageItemId,
          verifyCode: code,
          verifierType: 'admin',
          verifierId,
          action: 'verify',
          remark: remark ?? null,
          createdAt: now,
        },
      });

      await (this.versionSettlementService as ProductionMerchantSettlementService)
        .generateServiceCommissionInTransaction(tx, {
          verificationLogId: verificationLog.id,
          entitlementId: lockedEntitlement.id,
          packageItemId: lockedEntitlement.packageItemId,
          packageId: userPkg.packageId,
          pickupStoreId: item.pickupStoreId ? BigInt(item.pickupStoreId) : null,
          merchantPromotionSourceId: item.merchantPromotionSourceId
            ? BigInt(item.merchantPromotionSourceId)
            : null,
          occurredAt: now,
        });

      return {
        entitlementId: lockedEntitlement.id,
        verifyCode: code,
        usedAt: now,
      };
    });
  }

  override async reconcileUsedEntitlementAuditGaps(limit = 200) {
    const rows = await this.versionPrisma.$queryRaw<Array<{
      entitlementId: bigint;
      userId: bigint;
      userBenefitPackageId: bigint;
      packageId: bigint;
      packageItemId: bigint;
      verifyCode: string;
      verifierId: bigint | null;
      remark: string | null;
      usedAt: Date | null;
    }>>`
      SELECT
        e.id AS entitlementId,
        e.user_id AS userId,
        e.user_benefit_package_id AS userBenefitPackageId,
        up.package_id AS packageId,
        e.package_item_id AS packageItemId,
        e.verify_code AS verifyCode,
        e.verified_by_admin_id AS verifierId,
        e.verify_remark AS remark,
        e.used_at AS usedAt
      FROM user_benefit_entitlements e
      INNER JOIN user_benefit_packages up ON up.id = e.user_benefit_package_id
      WHERE e.deleted_at IS NULL
        AND e.status = 'used'
        AND NOT EXISTS (
          SELECT 1 FROM user_benefit_verification_logs l
          WHERE l.entitlement_id = e.id AND l.action = 'verify'
        )
      ORDER BY COALESCE(e.used_at, e.updated_at) ASC
      LIMIT ${limit}
    `;

    let repaired = 0;
    let failed = 0;
    for (const row of rows) {
      try {
        const didRepair = await this.versionPrisma.$transaction(async (tx) => {
          await tx.$queryRaw`
            SELECT id FROM user_benefit_entitlements WHERE id = ${row.entitlementId} FOR UPDATE
          `;
          const existingLog = await tx.userBenefitVerificationLog.findFirst({
            where: { entitlementId: row.entitlementId, action: 'verify' },
            select: { id: true },
          });
          if (existingLog) return false;
          const entitlement = await tx.userBenefitEntitlement.findUnique({ where: { id: row.entitlementId } });
          const userPkg = await tx.userBenefitPackage.findUnique({ where: { id: row.userBenefitPackageId } });
          if (!entitlement || entitlement.status !== 'used' || !userPkg) return false;
          const resolved = await this.resolveEntitlementSnapshot(tx, entitlement, userPkg, true);
          if (!resolved.item) throw new Error(`核销审计补偿失败：权益项快照不存在 entitlementId=${row.entitlementId}`);

          const occurredAt = row.usedAt ?? new Date();
          const log = await tx.userBenefitVerificationLog.create({
            data: {
              entitlementId: row.entitlementId,
              userId: row.userId,
              packageId: row.packageId,
              packageItemId: row.packageItemId,
              verifyCode: row.verifyCode,
              verifierType: 'admin',
              verifierId: row.verifierId,
              action: 'verify',
              remark: row.remark,
              createdAt: occurredAt,
            },
          });
          await (this.versionSettlementService as ProductionMerchantSettlementService)
            .generateServiceCommissionInTransaction(tx, {
              verificationLogId: log.id,
              entitlementId: row.entitlementId,
              packageItemId: row.packageItemId,
              packageId: row.packageId,
              pickupStoreId: resolved.item.pickupStoreId ? BigInt(resolved.item.pickupStoreId) : null,
              merchantPromotionSourceId: resolved.item.merchantPromotionSourceId
                ? BigInt(resolved.item.merchantPromotionSourceId)
                : null,
              occurredAt,
            });
          return true;
        });
        if (didRepair) repaired += 1;
      } catch (error) {
        failed += 1;
        this.versionLogger.error(
          `核销审计补偿失败 entitlementId=${row.entitlementId}`,
          (error as Error).message,
        );
      }
    }
    return { total: rows.length, repaired, failed };
  }

  private async ensureOrderBenefits(orderId: string | bigint, userId: string | bigint) {
    const oid = BigInt(orderId);
    const uid = BigInt(userId);
    const order = await this.versionPrisma.order.findUnique({
      where: { id: oid },
      include: { orderItems: true },
    });
    if (!order) throw new Error(`权益发放失败：订单不存在 orderId=${orderId}`);

    const refunded = await this.versionPrisma.aftersaleOrder.findMany({
      where: { orderId: oid, status: 'refunded' },
      select: { orderItemId: true },
    });
    const refundedItemIds = new Set(refunded.map((item) => item.orderItemId.toString()));

    for (const orderItem of order.orderItems) {
      if (refundedItemIds.has(orderItem.id.toString())) continue;
      const snapshot = await this.resolveAndPersistOrderItemSnapshot(order, orderItem);
      const pkg = snapshot.package;
      if (!pkg || pkg.status !== 1) continue;
      const qty = orderItem.quantity > 0 ? orderItem.quantity : 1;
      for (let unit = 0; unit < qty; unit += 1) {
        await this.ensureGrantFromSnapshot(
          uid,
          oid,
          orderItem.id,
          pkg,
          unit,
        );
      }
    }

    await this.assertSnapshotBenefitsComplete(order, refundedItemIds);
  }

  private async assertSnapshotBenefitsComplete(
    order: { id: bigint; orderItems: Array<{ id: bigint; productId: bigint; quantity: number }> },
    refundedItemIds: Set<string>,
  ) {
    for (const orderItem of order.orderItems) {
      if (refundedItemIds.has(orderItem.id.toString())) continue;
      const snapshot = await this.resolveAndPersistOrderItemSnapshot(order as any, orderItem as any);
      const pkg = snapshot.package;
      if (!pkg || pkg.status !== 1) continue;
      const activeItems = pkg.items.filter((item) => item.status === 1);
      const qty = orderItem.quantity > 0 ? orderItem.quantity : 1;
      for (let unit = 0; unit < qty; unit += 1) {
        const grantKey = this.grantKey(orderItem.id, unit, pkg.id);
        const userPackage = await this.versionPrisma.userBenefitPackage.findUnique({
          where: { grantKey },
          select: { id: true },
        });
        if (!userPackage) throw new Error(`权益包未完整发放：${grantKey}`);
        for (const item of activeItems) {
          const expected = item.quantity > 0 ? item.quantity : 1;
          const actual = await this.versionPrisma.userBenefitEntitlement.count({
            where: {
              userBenefitPackageId: userPackage.id,
              packageItemId: BigInt(item.id),
              deletedAt: null,
            },
          });
          if (actual < expected) {
            throw new Error(
              `权益码未完整发放：grantKey=${grantKey}, itemId=${item.id}, expected=${expected}, actual=${actual}`,
            );
          }
        }
      }
    }
  }

  private async ensureGrantFromSnapshot(
    userId: bigint,
    orderId: bigint,
    orderItemId: bigint,
    pkg: BenefitPackageSnapshot,
    unit: number,
  ) {
    const grantKey = this.grantKey(orderItemId, unit, pkg.id);
    await this.versionPrisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE
      `;
      let userPkg = await tx.userBenefitPackage.findUnique({ where: { grantKey } });
      if (!userPkg) {
        const now = new Date();
        const configuredStart = pkg.validStartAt ? new Date(pkg.validStartAt) : null;
        const validFrom = configuredStart && configuredStart > now ? configuredStart : now;
        let validTo = pkg.validEndAt ? new Date(pkg.validEndAt) : null;
        if (!validTo && pkg.validDays && pkg.validDays > 0) {
          validTo = new Date(validFrom.getTime() + pkg.validDays * 24 * 60 * 60 * 1000);
        }
        try {
          userPkg = await tx.userBenefitPackage.create({
            data: {
              userId,
              packageId: BigInt(pkg.id),
              orderId,
              orderItemId,
              grantKey,
              status: 'active',
              validFrom,
              validTo,
            },
          });
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            userPkg = await tx.userBenefitPackage.findUnique({ where: { grantKey } });
          } else {
            throw error;
          }
        }
        if (!userPkg) throw new Error(`权益包幂等创建失败：${grantKey}`);
      }

      await this.ensureSnapshotEvent(tx, USER_PACKAGE_SNAPSHOT_EVENT, USER_PACKAGE_BIZ_TYPE, userPkg.id.toString(), {
        version: 1,
        grantKey,
        package: pkg,
      });

      if (!['active', 'refund_pending'].includes(userPkg.status)) return;
      for (const item of pkg.items.filter((candidate) => candidate.status === 1)) {
        const expected = item.quantity > 0 ? item.quantity : 1;
        const existing = await tx.userBenefitEntitlement.findMany({
          where: {
            userBenefitPackageId: userPkg.id,
            packageItemId: BigInt(item.id),
            deletedAt: null,
          },
          orderBy: { id: 'asc' },
        });
        for (const entitlement of existing) {
          await this.ensureSnapshotEvent(
            tx,
            ENTITLEMENT_SNAPSHOT_EVENT,
            ENTITLEMENT_BIZ_TYPE,
            entitlement.id.toString(),
            { version: 1, packageId: pkg.id, item },
          );
        }
        for (let index = existing.length; index < expected; index += 1) {
          await this.createEntitlementFromSnapshot(tx, userPkg.id, userId, pkg.id, item);
        }
      }
    });
  }

  private async createEntitlementFromSnapshot(
    tx: Prisma.TransactionClient,
    userBenefitPackageId: bigint,
    userId: bigint,
    packageId: string,
    item: BenefitItemSnapshot,
  ) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const verifyCode = this.generateVerifyCode();
      try {
        const entitlement = await tx.userBenefitEntitlement.create({
          data: {
            userBenefitPackageId,
            userId,
            packageItemId: BigInt(item.id),
            verifyCode,
            status: 'unused',
          },
        });
        await tx.businessEvent.create({
          data: {
            eventType: ENTITLEMENT_SNAPSHOT_EVENT,
            bizType: ENTITLEMENT_BIZ_TYPE,
            bizId: entitlement.id.toString(),
            level: 'info',
            message: `冻结权益项配置 entitlementId=${entitlement.id}`,
            payload: { version: 1, packageId, item } as Prisma.InputJsonValue,
          },
        });
        return entitlement;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' &&
          attempt < 7
        ) {
          continue;
        }
        throw error;
      }
    }
    throw new Error('权益核销码生成失败');
  }

  private async resolveAndPersistOrderItemSnapshot(
    order: { id: bigint; createdAt: Date },
    orderItem: { id: bigint; productId: bigint },
  ): Promise<ProductBenefitSnapshot> {
    const existing = await this.versionPrisma.businessEvent.findFirst({
      where: {
        eventType: ORDER_ITEM_SNAPSHOT_EVENT,
        bizType: ORDER_ITEM_BIZ_TYPE,
        bizId: orderItem.id.toString(),
      },
      orderBy: { createdAt: 'asc' },
    });
    if (existing) return this.parseProductSnapshot(existing.payload, orderItem.productId);

    const snapshot = await this.resolveProductConfigAt(orderItem.productId, order.createdAt);
    await this.versionPrisma.businessEvent.create({
      data: {
        eventType: ORDER_ITEM_SNAPSHOT_EVENT,
        bizType: ORDER_ITEM_BIZ_TYPE,
        bizId: orderItem.id.toString(),
        level: 'info',
        message: `冻结订单权益配置 orderId=${order.id}, orderItemId=${orderItem.id}`,
        payload: {
          version: 1,
          orderId: order.id.toString(),
          orderItemId: orderItem.id.toString(),
          productId: orderItem.productId.toString(),
          orderCreatedAt: order.createdAt.toISOString(),
          config: snapshot,
        } as Prisma.InputJsonValue,
      },
    });
    return snapshot;
  }

  private async resolveProductConfigAt(productId: bigint, at: Date): Promise<ProductBenefitSnapshot> {
    const futureVersion = await this.versionPrisma.businessEvent.findFirst({
      where: {
        eventType: CONFIG_VERSION_EVENT,
        bizType: CONFIG_BIZ_TYPE,
        bizId: productId.toString(),
        createdAt: { gte: at },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    if (futureVersion) return this.parseProductSnapshot(futureVersion.payload, productId);

    const currentPkg = await this.versionPrisma.benefitPackage.findFirst({
      where: { productId },
    });
    if (!currentPkg) {
      return { version: 1, productId: productId.toString(), package: null };
    }
    const items = await this.versionPrisma.benefitPackageItem.findMany({
      where: { packageId: currentPkg.id },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });

    const changedAfterOrder =
      currentPkg.createdAt > at ||
      currentPkg.updatedAt > at ||
      items.some((item) => item.createdAt > at || item.updatedAt > at);
    if (changedAfterOrder) {
      throw new Error(
        `历史权益配置在下单后发生过变更且缺少版本快照，停止自动发放：productId=${productId}`,
      );
    }
    if (currentPkg.deletedAt) {
      return { version: 1, productId: productId.toString(), package: null };
    }
    return {
      version: 1,
      productId: productId.toString(),
      package: this.serializePackage(currentPkg, items.filter((item) => !item.deletedAt)),
    };
  }

  private async resolveEntitlementSnapshot(
    client: DbClient,
    entitlement: { id: bigint; packageItemId: bigint },
    userPkg: { id: bigint; orderId: bigint; orderItemId: bigint | null; packageId: bigint },
    persist: boolean,
  ): Promise<{ package: BenefitPackageSnapshot | null; item: BenefitItemSnapshot | null }> {
    const event = await (client as any).businessEvent.findFirst({
      where: {
        eventType: ENTITLEMENT_SNAPSHOT_EVENT,
        bizType: ENTITLEMENT_BIZ_TYPE,
        bizId: entitlement.id.toString(),
      },
      orderBy: { createdAt: 'asc' },
    });
    if (event) {
      const payload = (event.payload ?? {}) as Record<string, any>;
      return {
        package: await this.resolveUserPackageSnapshot(client, userPkg),
        item: this.parseItemSnapshot(payload.item),
      };
    }

    const pkg = await this.resolveUserPackageSnapshot(client, userPkg);
    const item = pkg?.items.find((candidate) => candidate.id === entitlement.packageItemId.toString()) ?? null;
    let resolvedItem = item;
    if (!resolvedItem) {
      const currentItem = await (client as any).benefitPackageItem.findFirst({
        where: { id: entitlement.packageItemId },
      });
      if (currentItem) resolvedItem = this.serializeItem(currentItem);
    }
    if (persist && resolvedItem) {
      await this.ensureSnapshotEvent(
        client,
        ENTITLEMENT_SNAPSHOT_EVENT,
        ENTITLEMENT_BIZ_TYPE,
        entitlement.id.toString(),
        { version: 1, packageId: userPkg.packageId.toString(), item: resolvedItem },
      );
    }
    return { package: pkg, item: resolvedItem };
  }

  private async resolveUserPackageSnapshot(
    client: DbClient,
    userPkg: { id: bigint; orderId: bigint; orderItemId: bigint | null; packageId: bigint },
  ): Promise<BenefitPackageSnapshot | null> {
    const event = await (client as any).businessEvent.findFirst({
      where: {
        eventType: USER_PACKAGE_SNAPSHOT_EVENT,
        bizType: USER_PACKAGE_BIZ_TYPE,
        bizId: userPkg.id.toString(),
      },
      orderBy: { createdAt: 'asc' },
    });
    if (event) {
      const payload = (event.payload ?? {}) as Record<string, any>;
      return this.parsePackageSnapshot(payload.package);
    }

    if (userPkg.orderItemId) {
      const orderSnapshot = await (client as any).businessEvent.findFirst({
        where: {
          eventType: ORDER_ITEM_SNAPSHOT_EVENT,
          bizType: ORDER_ITEM_BIZ_TYPE,
          bizId: userPkg.orderItemId.toString(),
        },
        orderBy: { createdAt: 'asc' },
      });
      if (orderSnapshot) {
        const parsed = this.parseProductSnapshot(orderSnapshot.payload, 0n);
        if (parsed.package) return parsed.package;
      }
    }

    const currentPkg = await (client as any).benefitPackage.findFirst({
      where: { id: userPkg.packageId },
    });
    if (!currentPkg) return null;
    const items = await (client as any).benefitPackageItem.findMany({
      where: { packageId: userPkg.packageId, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    return this.serializePackage(currentPkg, items);
  }

  private async recordProductConfigBeforeChange(
    tx: Prisma.TransactionClient,
    productId: bigint,
    reason: string,
  ) {
    const snapshot = await this.captureCurrentProductConfig(tx, productId);
    await tx.businessEvent.create({
      data: {
        eventType: CONFIG_VERSION_EVENT,
        bizType: CONFIG_BIZ_TYPE,
        bizId: productId.toString(),
        level: 'info',
        message: `${reason}前冻结商品权益配置 productId=${productId}`,
        payload: snapshot as Prisma.InputJsonValue,
      },
    });
  }

  private async captureCurrentProductConfig(
    client: DbClient,
    productId: bigint,
  ): Promise<ProductBenefitSnapshot> {
    const pkg = await (client as any).benefitPackage.findFirst({
      where: { productId, deletedAt: null },
    });
    if (!pkg) return { version: 1, productId: productId.toString(), package: null };
    const items = await (client as any).benefitPackageItem.findMany({
      where: { packageId: pkg.id, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    return {
      version: 1,
      productId: productId.toString(),
      package: this.serializePackage(pkg, items),
    };
  }

  private async lockAndAssertProduct(tx: Prisma.TransactionClient, productId: bigint) {
    const rows = await tx.$queryRaw<Array<{ id: bigint }>>`
      SELECT id FROM products WHERE id = ${productId} AND deleted_at IS NULL FOR UPDATE
    `;
    if (rows.length === 0) throw new BadRequestException('绑定商品不存在');
  }

  private async syncItemsInTransaction(
    tx: Prisma.TransactionClient,
    packageId: bigint,
    items: any[],
  ) {
    const existing = await tx.benefitPackageItem.findMany({
      where: { packageId, deletedAt: null },
    });
    const existingById = new Map(existing.map((item) => [item.id.toString(), item]));
    const incomingIds = new Set<string>();

    for (const item of items) {
      if (!item.id) continue;
      const id = parsePositiveBigIntId(String(item.id), '权益项');
      if (!existingById.has(id.toString())) {
        throw new BadRequestException(`权益项${id}不属于当前权益包`);
      }
      incomingIds.add(id.toString());
    }

    const toRemove = existing.filter((item) => !incomingIds.has(item.id.toString()));
    if (toRemove.length > 0) {
      await tx.benefitPackageItem.updateMany({
        where: { id: { in: toRemove.map((item) => item.id) } },
        data: { deletedAt: new Date() },
      });
    }

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const merchantPromotionSourceId = cleanId(item.merchantPromotionSourceId, '商家推广源');
      const pickupStoreId = cleanId(item.pickupStoreId, '自提点');
      if (merchantPromotionSourceId) {
        const merchant = await tx.merchantPromotionSource.findFirst({
          where: { id: merchantPromotionSourceId, deletedAt: null, status: 1 },
          select: { id: true },
        });
        if (!merchant) throw new BadRequestException('权益项绑定的商家不存在或已停用');
      }
      if (pickupStoreId) {
        const store = await tx.pickupStore.findFirst({
          where: { id: pickupStoreId, deletedAt: null, status: 1 },
          select: { id: true },
        });
        if (!store) throw new BadRequestException('权益项绑定的门店不存在或已停用');
      }

      const quantity = optionalInt(item.quantity) ?? 1;
      const originalValue = optionalInt(item.originalValue);
      const verifyRequired = optionalInt(item.verifyRequired) ?? 1;
      const status = optionalInt(item.status) ?? 1;
      const sortOrder = optionalInt(item.sortOrder) ?? index;
      if (quantity <= 0 || quantity > 999) throw new BadRequestException('权益数量必须为1-999');
      if (originalValue !== undefined && originalValue !== null && originalValue < 0) {
        throw new BadRequestException('权益原价值不能为负数');
      }
      if (![0, 1].includes(verifyRequired)) throw new BadRequestException('权益核销配置无效');
      if (![0, 1].includes(status)) throw new BadRequestException('权益项状态无效');

      const payload = {
        packageId,
        merchantPromotionSourceId,
        pickupStoreId,
        name: String(item.name || '').trim(),
        itemType: item.itemType || 'service',
        description: item.description ?? null,
        quantity,
        originalValue: originalValue ?? null,
        verifyRequired,
        status,
        sortOrder,
      };
      if (!payload.name) throw new BadRequestException('权益项名称不能为空');
      if (item.id) {
        await tx.benefitPackageItem.update({
          where: { id: BigInt(item.id) },
          data: payload,
        });
      } else {
        await tx.benefitPackageItem.create({ data: payload });
      }
    }
  }

  private buildPackageCreateData(data: any, productId: bigint | null) {
    const status = optionalInt(data.status) ?? 0;
    const sortOrder = optionalInt(data.sortOrder) ?? 0;
    const price = optionalInt(data.price);
    const validDays = optionalInt(data.validDays);
    if (![0, 1].includes(status)) throw new BadRequestException('权益包状态无效');
    if (price !== undefined && price !== null && price < 0) throw new BadRequestException('权益包价格不能为负数');
    if (validDays !== undefined && validDays !== null && validDays <= 0) throw new BadRequestException('权益有效天数必须大于0');
    return {
      productId,
      name: String(data.name || '').trim(),
      subtitle: data.subtitle ?? null,
      coverImage: data.coverImage ?? null,
      description: data.description ?? null,
      price: price ?? null,
      validDays: validDays ?? null,
      validStartAt: data.validStartAt ? new Date(data.validStartAt) : null,
      validEndAt: data.validEndAt ? new Date(data.validEndAt) : null,
      status,
      sortOrder,
    };
  }

  private buildPackageUpdateData(
    data: any,
    productId: bigint | null,
    productSpecified: boolean,
  ): Prisma.BenefitPackageUncheckedUpdateInput {
    const updateData: Prisma.BenefitPackageUncheckedUpdateInput = {};
    if (productSpecified) updateData.productId = productId;
    if (data.name !== undefined) updateData.name = String(data.name || '').trim();
    if (data.subtitle !== undefined) updateData.subtitle = data.subtitle ?? null;
    if (data.coverImage !== undefined) updateData.coverImage = data.coverImage ?? null;
    if (data.description !== undefined) updateData.description = data.description ?? null;
    if (data.price !== undefined) {
      const value = optionalInt(data.price);
      if (value !== null && value !== undefined && value < 0) throw new BadRequestException('权益包价格不能为负数');
      updateData.price = value;
    }
    if (data.validDays !== undefined) {
      const value = optionalInt(data.validDays);
      if (value !== null && value !== undefined && value <= 0) throw new BadRequestException('权益有效天数必须大于0');
      updateData.validDays = value;
    }
    if (data.validStartAt !== undefined) updateData.validStartAt = data.validStartAt ? new Date(data.validStartAt) : null;
    if (data.validEndAt !== undefined) updateData.validEndAt = data.validEndAt ? new Date(data.validEndAt) : null;
    if (data.status !== undefined) {
      const status = optionalInt(data.status);
      if (status === null || status === undefined || ![0, 1].includes(status)) throw new BadRequestException('权益包状态无效');
      updateData.status = status;
    }
    if (data.sortOrder !== undefined) updateData.sortOrder = optionalInt(data.sortOrder) ?? 0;
    return updateData;
  }

  private serializePackage(pkg: any, items: any[]): BenefitPackageSnapshot {
    return {
      id: pkg.id.toString(),
      productId: pkg.productId?.toString() ?? null,
      name: pkg.name,
      subtitle: pkg.subtitle ?? null,
      coverImage: pkg.coverImage ?? null,
      description: pkg.description ?? null,
      price: pkg.price ?? null,
      validDays: pkg.validDays ?? null,
      validStartAt: pkg.validStartAt ? new Date(pkg.validStartAt).toISOString() : null,
      validEndAt: pkg.validEndAt ? new Date(pkg.validEndAt).toISOString() : null,
      status: Number(pkg.status ?? 0),
      sortOrder: Number(pkg.sortOrder ?? 0),
      items: items.map((item) => this.serializeItem(item)),
    };
  }

  private serializeItem(item: any): BenefitItemSnapshot {
    return {
      id: item.id.toString(),
      merchantPromotionSourceId: item.merchantPromotionSourceId?.toString() ?? null,
      pickupStoreId: item.pickupStoreId?.toString() ?? null,
      name: item.name,
      itemType: item.itemType || 'service',
      description: item.description ?? null,
      quantity: Number(item.quantity ?? 1),
      originalValue: item.originalValue ?? null,
      verifyRequired: Number(item.verifyRequired ?? 1),
      status: Number(item.status ?? 1),
      sortOrder: Number(item.sortOrder ?? 0),
    };
  }

  private parseProductSnapshot(payload: unknown, fallbackProductId: bigint): ProductBenefitSnapshot {
    const object = (payload ?? {}) as Record<string, any>;
    const nested = object.config && typeof object.config === 'object' ? object.config : object;
    return {
      version: 1,
      productId: String(nested.productId ?? fallbackProductId.toString()),
      package: this.parsePackageSnapshot(nested.package),
    };
  }

  private parsePackageSnapshot(value: unknown): BenefitPackageSnapshot | null {
    if (!value || typeof value !== 'object') return null;
    const pkg = value as Record<string, any>;
    if (!pkg.id) return null;
    return {
      id: String(pkg.id),
      productId: pkg.productId == null ? null : String(pkg.productId),
      name: String(pkg.name ?? ''),
      subtitle: pkg.subtitle == null ? null : String(pkg.subtitle),
      coverImage: pkg.coverImage == null ? null : String(pkg.coverImage),
      description: pkg.description == null ? null : String(pkg.description),
      price: pkg.price == null ? null : Number(pkg.price),
      validDays: pkg.validDays == null ? null : Number(pkg.validDays),
      validStartAt: pkg.validStartAt == null ? null : String(pkg.validStartAt),
      validEndAt: pkg.validEndAt == null ? null : String(pkg.validEndAt),
      status: Number(pkg.status ?? 0),
      sortOrder: Number(pkg.sortOrder ?? 0),
      items: Array.isArray(pkg.items)
        ? pkg.items.map((item) => this.parseItemSnapshot(item)).filter((item): item is BenefitItemSnapshot => !!item)
        : [],
    };
  }

  private parseItemSnapshot(value: unknown): BenefitItemSnapshot | null {
    if (!value || typeof value !== 'object') return null;
    const item = value as Record<string, any>;
    if (!item.id) return null;
    return {
      id: String(item.id),
      merchantPromotionSourceId: item.merchantPromotionSourceId == null
        ? null
        : String(item.merchantPromotionSourceId),
      pickupStoreId: item.pickupStoreId == null ? null : String(item.pickupStoreId),
      name: String(item.name ?? ''),
      itemType: String(item.itemType ?? 'service'),
      description: item.description == null ? null : String(item.description),
      quantity: Number(item.quantity ?? 1),
      originalValue: item.originalValue == null ? null : Number(item.originalValue),
      verifyRequired: Number(item.verifyRequired ?? 1),
      status: Number(item.status ?? 1),
      sortOrder: Number(item.sortOrder ?? 0),
    };
  }

  private async ensureSnapshotEvent(
    client: DbClient,
    eventType: string,
    bizType: string,
    bizId: string,
    payload: Record<string, any>,
  ) {
    const existing = await (client as any).businessEvent.findFirst({
      where: { eventType, bizType, bizId },
      select: { id: true },
    });
    if (existing) return;
    await (client as any).businessEvent.create({
      data: {
        eventType,
        bizType,
        bizId,
        level: 'info',
        message: `冻结权益业务快照 ${eventType}:${bizId}`,
        payload: payload as Prisma.InputJsonValue,
      },
    });
  }

  private grantKey(orderItemId: bigint, unit: number, packageId: string) {
    return `order_item:${orderItemId}:unit:${unit}:package:${packageId}`;
  }

  private generateVerifyCode() {
    let code = '';
    for (let index = 0; index < VERIFY_CODE_LENGTH; index += 1) {
      code += VERIFY_CODE_CHARS[crypto.randomInt(0, VERIFY_CODE_CHARS.length)];
    }
    return code;
  }
}
