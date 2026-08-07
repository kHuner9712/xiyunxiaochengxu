import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MerchantSettlementService } from '../merchant-settlement/merchant-settlement.service';
import { ProductionMerchantSettlementService } from '../merchant-settlement/production-merchant-settlement.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { ProductionBenefitPackageService } from './production-benefit-package.service';

@Injectable()
export class SnapshotGuardedProductionBenefitPackageService extends ProductionBenefitPackageService {
  constructor(
    private readonly snapshotPrisma: PrismaService,
    @Inject(MerchantSettlementService)
    private readonly snapshotMerchantSettlementService: ProductionMerchantSettlementService,
  ) {
    super(snapshotPrisma, snapshotMerchantSettlementService);
  }

  override async grantBenefitsForOrder(orderId: string | bigint, userId: string | bigint) {
    await this.assertBenefitConfigurationStableSinceOrder(orderId);
    return super.grantBenefitsForOrder(orderId, userId);
  }

  override async reconcileOrderBenefits(orderId: string | bigint, userId: string | bigint) {
    await this.assertBenefitConfigurationStableSinceOrder(orderId);
    return super.reconcileOrderBenefits(orderId, userId);
  }

  override async verify(verifyCode: string, adminId: string, remark?: string) {
    const code = String(verifyCode || '').trim().toUpperCase();
    if (!code) throw new BadRequestException('核销码不能为空');
    const verifierId = parsePositiveBigIntId(adminId, '管理员');

    return this.snapshotPrisma.$transaction(async (tx) => {
      const entitlement = await tx.userBenefitEntitlement.findFirst({
        where: { verifyCode: code, deletedAt: null },
      });
      if (!entitlement) throw new NotFoundException('权益码不存在');

      await tx.$queryRaw`
        SELECT id FROM user_benefit_entitlements
        WHERE id = ${entitlement.id}
        FOR UPDATE
      `;
      const lockedEntitlement = await tx.userBenefitEntitlement.findUnique({
        where: { id: entitlement.id },
      });
      if (!lockedEntitlement || lockedEntitlement.deletedAt) {
        throw new NotFoundException('权益码不存在');
      }
      if (lockedEntitlement.status === 'used') {
        throw new BadRequestException('该权益已被核销，请勿重复核销');
      }
      if (lockedEntitlement.status !== 'unused') {
        throw new BadRequestException(`权益状态为${lockedEntitlement.status}，不可核销`);
      }

      const userPkg = await tx.userBenefitPackage.findFirst({
        where: { id: lockedEntitlement.userBenefitPackageId, deletedAt: null },
      });
      if (!userPkg) throw new BadRequestException('权益包不存在');
      if (userPkg.status !== 'active') {
        throw new BadRequestException(`权益包状态为${userPkg.status}，不可核销`);
      }

      const now = new Date();
      if (userPkg.validFrom && userPkg.validFrom > now) {
        throw new BadRequestException('权益尚未生效，不可核销');
      }
      if (userPkg.validTo && userPkg.validTo < now) {
        throw new BadRequestException('权益已过期，不可核销');
      }

      const item = await tx.benefitPackageItem.findFirst({
        where: { id: lockedEntitlement.packageItemId },
      });
      if (!item) throw new BadRequestException('权益项不存在');
      if (item.status !== 1) throw new BadRequestException('权益项已停用');
      if (item.verifyRequired !== 1) {
        throw new BadRequestException('该权益项无需核销');
      }

      const claim = await tx.userBenefitEntitlement.updateMany({
        where: { id: lockedEntitlement.id, status: 'unused' },
        data: {
          status: 'used',
          usedAt: now,
          verifiedByAdminId: verifierId,
          verifyRemark: remark ?? null,
        },
      });
      if (claim.count !== 1) {
        throw new BadRequestException('核销失败：该权益可能已被其他操作核销');
      }

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

      // Service settlement is part of the same business transaction. If a matching rule exists
      // and commission persistence fails, the entitlement remains unused and the operator can
      // retry safely instead of leaving a used entitlement without accounting records.
      await this.snapshotMerchantSettlementService.generateServiceCommissionInTransaction(tx, {
        verificationLogId: verificationLog.id,
        entitlementId: lockedEntitlement.id,
        packageItemId: lockedEntitlement.packageItemId,
        packageId: userPkg.packageId,
        pickupStoreId: item.pickupStoreId,
        merchantPromotionSourceId: item.merchantPromotionSourceId,
        occurredAt: now,
      });

      return {
        entitlementId: lockedEntitlement.id,
        verifyCode: code,
        usedAt: now,
      };
    });
  }

  async reconcileUsedEntitlementAuditGaps(limit = 200) {
    const rows = await this.snapshotPrisma.$queryRaw<Array<{
      entitlementId: bigint;
      userId: bigint;
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
          SELECT 1
          FROM user_benefit_verification_logs l
          WHERE l.entitlement_id = e.id
            AND l.action = 'verify'
        )
      ORDER BY COALESCE(e.used_at, e.updated_at) ASC
      LIMIT ${limit}
    `;

    let repaired = 0;
    let failed = 0;
    for (const row of rows) {
      try {
        const didRepair = await this.snapshotPrisma.$transaction(async (tx) => {
          await tx.$queryRaw`
            SELECT id FROM user_benefit_entitlements
            WHERE id = ${row.entitlementId}
            FOR UPDATE
          `;
          const existingLog = await tx.userBenefitVerificationLog.findFirst({
            where: { entitlementId: row.entitlementId, action: 'verify' },
            select: { id: true },
          });
          if (existingLog) return false;

          const entitlement = await tx.userBenefitEntitlement.findUnique({
            where: { id: row.entitlementId },
          });
          if (!entitlement || entitlement.status !== 'used') return false;
          const item = await tx.benefitPackageItem.findFirst({
            where: { id: row.packageItemId },
          });
          if (!item) throw new Error(`核销审计补偿失败：权益项不存在 itemId=${row.packageItemId}`);

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
          await this.snapshotMerchantSettlementService.generateServiceCommissionInTransaction(tx, {
            verificationLogId: log.id,
            entitlementId: row.entitlementId,
            packageItemId: row.packageItemId,
            packageId: row.packageId,
            pickupStoreId: item.pickupStoreId,
            merchantPromotionSourceId: item.merchantPromotionSourceId,
            occurredAt,
          });
          return true;
        });
        if (didRepair) repaired += 1;
      } catch (error) {
        failed += 1;
        // The scheduled caller logs the aggregate; leave the durable used entitlement untouched
        // so it remains discoverable on the next pass.
      }
    }
    return { total: rows.length, repaired, failed };
  }

  private async assertBenefitConfigurationStableSinceOrder(orderId: string | bigint) {
    const order = await this.snapshotPrisma.order.findUnique({
      where: { id: BigInt(orderId) },
      select: {
        id: true,
        createdAt: true,
        orderItems: {
          select: { productId: true },
        },
      },
    });
    if (!order) throw new Error(`权益配置校验失败：订单不存在 orderId=${orderId}`);

    const productIds = Array.from(new Set(order.orderItems.map((item) => item.productId)));
    if (productIds.length === 0) return;

    const packages = await this.snapshotPrisma.benefitPackage.findMany({
      where: { productId: { in: productIds } },
      select: {
        id: true,
        productId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    for (const pkg of packages) {
      if (pkg.createdAt > order.createdAt || pkg.updatedAt > order.createdAt) {
        throw new Error(
          `权益配置在下单后发生变更，停止自动发放/补偿：orderId=${order.id}, packageId=${pkg.id}`,
        );
      }

      const items = await this.snapshotPrisma.benefitPackageItem.findMany({
        where: { packageId: pkg.id },
        select: {
          id: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      const driftedItem = items.find(
        (item) => item.createdAt > order.createdAt || item.updatedAt > order.createdAt,
      );
      if (driftedItem) {
        throw new Error(
          `权益项在下单后发生变更，停止自动发放/补偿：orderId=${order.id}, packageId=${pkg.id}, itemId=${driftedItem.id}`,
        );
      }
    }
  }
}
