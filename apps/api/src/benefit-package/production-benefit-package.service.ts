import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MerchantSettlementService } from '../merchant-settlement/merchant-settlement.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { BenefitPackageService } from './benefit-package.service';
import { calculateOrderItemRefundCap } from '../common/utils/refund-amount';

const VERIFY_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const VERIFY_CODE_LENGTH = 8;

@Injectable()
export class ProductionBenefitPackageService extends BenefitPackageService {
  private readonly productionLogger = new Logger(ProductionBenefitPackageService.name);

  constructor(
    private readonly productionPrisma: PrismaService,
    merchantSettlementService: MerchantSettlementService,
  ) {
    super(productionPrisma, merchantSettlementService);
  }

  /**
   * Base issuance keeps the payment callback resilient by logging its own errors. Production
   * must additionally verify the result so the durable paid-order side-effect reconciler can
   * detect a partial grant instead of silently treating it as complete.
   */
  override async grantBenefitsForOrder(orderId: string | bigint, userId: string | bigint) {
    await super.grantBenefitsForOrder(orderId, userId);
    await this.assertOrderBenefitsComplete(orderId);
  }

  /**
   * Repair is intentionally separated from the immediate callback path. The scheduler invokes
   * it after the original grant attempt has finished, locks each user-benefit package row and
   * only fills missing entitlement counts. This avoids duplicate codes if a callback was merely
   * slow while still making a partially-created package self-healing.
   */
  async reconcileOrderBenefits(orderId: string | bigint, userId: string | bigint) {
    await super.grantBenefitsForOrder(orderId, userId);
    const targets = await this.getExpectedGrantTargets(orderId);
    for (const target of targets) {
      if (!target.userPackageId) continue;
      await this.repairUserPackageEntitlements(
        target.userPackageId,
        BigInt(userId),
        target.packageId,
      );
    }
    await this.assertOrderBenefitsComplete(orderId);
  }

  async assertRefundable(orderId: bigint | string, aftersaleId?: bigint | string | null) {
    const packageIds = await this.findAffectedPackageIds(orderId, aftersaleId);
    if (packageIds.length === 0) return;

    const usedEntitlement = await this.productionPrisma.userBenefitEntitlement.findFirst({
      where: {
        userBenefitPackageId: { in: packageIds },
        status: 'used',
        deletedAt: null,
      },
      select: { id: true },
    });
    if (usedEntitlement) {
      throw new BadRequestException('该商品包含已核销权益，无法在线退款，请联系管理员人工处理');
    }
  }

  async assertRefundAmountSupported(
    orderId: bigint | string,
    aftersaleId: bigint | string | null | undefined,
    refundAmount: number,
  ) {
    if (!aftersaleId) return;
    const packageIds = await this.findAffectedPackageIds(orderId, aftersaleId);
    if (packageIds.length === 0) return;

    const aftersale = await this.productionPrisma.aftersaleOrder.findFirst({
      where: { id: BigInt(aftersaleId), orderId: BigInt(orderId) },
      include: {
        orderItem: true,
        order: {
          include: {
            orderItems: true,
            orderRefunds: true,
            aftersaleOrders: true,
          },
        },
      },
    });
    if (!aftersale) throw new BadRequestException('售后单与订单不匹配');

    const cap = calculateOrderItemRefundCap(
      aftersale.order,
      aftersale.orderItem,
      aftersale.id,
    );
    if (refundAmount !== cap.remainingAmount) {
      throw new BadRequestException(
        `权益类商品在线退款必须一次退清该商品剩余可退金额${cap.remainingAmount}分，避免退款金额与权益撤销不一致`,
      );
    }
  }

  async freezeForRefund(orderId: bigint | string, aftersaleId?: bigint | string | null) {
    const packageIds = await this.findAffectedPackageIds(orderId, aftersaleId);
    if (packageIds.length === 0) return { affected: 0 };

    await this.assertRefundable(orderId, aftersaleId);
    if (aftersaleId) {
      const aftersale = await this.productionPrisma.aftersaleOrder.findFirst({
        where: { id: BigInt(aftersaleId), orderId: BigInt(orderId) },
        select: { refundAmount: true },
      });
      if (!aftersale?.refundAmount) {
        throw new BadRequestException('权益类商品退款金额未设置');
      }
      await this.assertRefundAmountSupported(orderId, aftersaleId, aftersale.refundAmount);
    }

    const result = await this.productionPrisma.userBenefitPackage.updateMany({
      where: {
        id: { in: packageIds },
        status: 'active',
        deletedAt: null,
      },
      data: { status: 'refund_pending' },
    });
    return { affected: result.count };
  }

  async restoreAfterRefundClosed(orderId: bigint | string, aftersaleId?: bigint | string | null) {
    const packageIds = await this.findAffectedPackageIds(orderId, aftersaleId, true);
    if (packageIds.length === 0) return { affected: 0 };

    const result = await this.productionPrisma.userBenefitPackage.updateMany({
      where: {
        id: { in: packageIds },
        status: 'refund_pending',
        deletedAt: null,
      },
      data: { status: 'active' },
    });
    return { affected: result.count };
  }

  async revokeAfterRefundSuccess(orderId: bigint | string, aftersaleId?: bigint | string | null) {
    const packageIds = await this.findAffectedPackageIds(orderId, aftersaleId, true);
    if (packageIds.length === 0) return { packages: 0, entitlements: 0 };

    const unexpectedUsed = await this.productionPrisma.userBenefitEntitlement.findFirst({
      where: {
        userBenefitPackageId: { in: packageIds },
        status: 'used',
        deletedAt: null,
      },
      select: { id: true },
    });
    if (unexpectedUsed) {
      this.productionLogger.error(
        `退款成功时发现权益已核销: entitlementId=${unexpectedUsed.id}, orderId=${orderId}`,
      );
      throw new Error('退款成功后的权益状态冲突，需要人工核查');
    }

    return this.productionPrisma.$transaction(async (tx) => {
      const entitlements = await tx.userBenefitEntitlement.updateMany({
        where: {
          userBenefitPackageId: { in: packageIds },
          status: 'unused',
          deletedAt: null,
        },
        data: { status: 'refunded' },
      });
      const packages = await tx.userBenefitPackage.updateMany({
        where: {
          id: { in: packageIds },
          status: { in: ['active', 'refund_pending'] },
          deletedAt: null,
        },
        data: { status: 'refunded' },
      });
      return { packages: packages.count, entitlements: entitlements.count };
    });
  }

  /**
   * 只补偿微信退款明确 CLOSED 后仍被冻结的权益。
   * ABNORMAL 代表退款异常，需要商户平台人工处理，不能视为“确定未退款”；
   * 在微信侧最终结果明确前必须继续冻结权益，避免后续退款成功时出现钱和权益双失。
   * 同一订单/售后范围只看最新一笔退款，避免旧 CLOSED 误解冻正在重试的新退款。
   */
  async reconcileTerminalRefundFreezes(limit = 200) {
    const frozen = await this.productionPrisma.userBenefitPackage.findMany({
      where: { status: 'refund_pending', deletedAt: null },
      select: { orderId: true },
      distinct: ['orderId'],
      take: limit,
    });

    let restored = 0;
    let skipped = 0;
    for (const item of frozen) {
      const refunds = await this.productionPrisma.orderRefund.findMany({
        where: { orderId: item.orderId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
      if (refunds.length === 0) {
        skipped += 1;
        continue;
      }

      const seenScopes = new Set<string>();
      for (const refund of refunds) {
        const scope = refund.aftersaleId?.toString() ?? 'full-order';
        if (seenScopes.has(scope)) continue;
        seenScopes.add(scope);

        if (refund.status === 'closed') {
          const result = await this.restoreAfterRefundClosed(
            refund.orderId,
            refund.aftersaleId,
          );
          restored += result.affected;
        } else {
          skipped += 1;
        }
      }
    }

    return { orders: frozen.length, restored, skipped };
  }

  private async getExpectedGrantTargets(orderId: bigint | string) {
    const order = await this.productionPrisma.order.findUnique({
      where: { id: BigInt(orderId) },
      include: { orderItems: true },
    });
    if (!order) throw new Error(`权益发放校验失败：订单不存在 orderId=${orderId}`);

    const targets: Array<{
      packageId: bigint;
      userPackageId: bigint | null;
      grantKey: string;
    }> = [];
    for (const item of order.orderItems) {
      const pkg = await this.productionPrisma.benefitPackage.findFirst({
        where: { productId: item.productId, deletedAt: null },
        select: { id: true },
      });
      if (!pkg) continue;

      const qty = item.quantity > 0 ? item.quantity : 1;
      for (let unit = 0; unit < qty; unit++) {
        const grantKey = `order_item:${item.id}:unit:${unit}:package:${pkg.id}`;
        const userPackage = await this.productionPrisma.userBenefitPackage.findUnique({
          where: { grantKey },
          select: { id: true },
        });
        targets.push({
          packageId: pkg.id,
          userPackageId: userPackage?.id ?? null,
          grantKey,
        });
      }
    }
    return targets;
  }

  private async assertOrderBenefitsComplete(orderId: bigint | string) {
    const targets = await this.getExpectedGrantTargets(orderId);
    for (const target of targets) {
      if (!target.userPackageId) {
        throw new Error(`权益包未完整发放：${target.grantKey}`);
      }
      const items = await this.productionPrisma.benefitPackageItem.findMany({
        where: { packageId: target.packageId, deletedAt: null, status: 1 },
        select: { id: true, quantity: true },
      });
      for (const item of items) {
        const expected = item.quantity > 0 ? item.quantity : 1;
        const actual = await this.productionPrisma.userBenefitEntitlement.count({
          where: {
            userBenefitPackageId: target.userPackageId,
            packageItemId: item.id,
            deletedAt: null,
          },
        });
        if (actual < expected) {
          throw new Error(
            `权益码未完整发放：grantKey=${target.grantKey}, itemId=${item.id}, expected=${expected}, actual=${actual}`,
          );
        }
      }
    }
  }

  private async repairUserPackageEntitlements(
    userPackageId: bigint,
    userId: bigint,
    packageId: bigint,
  ) {
    await this.productionPrisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM user_benefit_packages
        WHERE id = ${userPackageId}
        FOR UPDATE
      `;
      const userPackage = await tx.userBenefitPackage.findUnique({
        where: { id: userPackageId },
        select: { id: true, status: true },
      });
      if (!userPackage || userPackage.status !== 'active') return;

      const items = await tx.benefitPackageItem.findMany({
        where: { packageId, deletedAt: null, status: 1 },
        select: { id: true, quantity: true },
        orderBy: { sortOrder: 'asc' },
      });
      for (const item of items) {
        const expected = item.quantity > 0 ? item.quantity : 1;
        const actual = await tx.userBenefitEntitlement.count({
          where: {
            userBenefitPackageId,
            packageItemId: item.id,
            deletedAt: null,
          },
        });
        const missing = Math.max(0, expected - actual);
        for (let index = 0; index < missing; index++) {
          await this.createRepairEntitlementWithRetry(tx, userPackageId, userId, item.id);
        }
      }
    });
  }

  private async createRepairEntitlementWithRetry(
    tx: Prisma.TransactionClient,
    userBenefitPackageId: bigint,
    userId: bigint,
    packageItemId: bigint,
    maxRetries = 5,
  ) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      let verifyCode = '';
      for (let i = 0; i < VERIFY_CODE_LENGTH; i++) {
        verifyCode += VERIFY_CODE_CHARS[Math.floor(Math.random() * VERIFY_CODE_CHARS.length)];
      }
      try {
        await tx.userBenefitEntitlement.create({
          data: {
            userBenefitPackageId,
            userId,
            packageItemId,
            verifyCode,
            status: 'unused',
          },
        });
        return;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' &&
          attempt < maxRetries - 1
        ) {
          continue;
        }
        throw error;
      }
    }
    throw new Error('权益补偿核销码生成失败');
  }

  private async findAffectedPackageIds(
    orderId: bigint | string,
    aftersaleId?: bigint | string | null,
    includeFrozen = false,
  ): Promise<bigint[]> {
    const orderIdValue = BigInt(orderId);
    let orderItemId: bigint | null = null;
    if (aftersaleId) {
      const aftersale = await this.productionPrisma.aftersaleOrder.findFirst({
        where: { id: BigInt(aftersaleId), orderId: orderIdValue },
        select: { orderItemId: true },
      });
      if (!aftersale) {
        throw new BadRequestException('售后单与订单不匹配');
      }
      orderItemId = aftersale.orderItemId;
    }

    const packages = await this.productionPrisma.userBenefitPackage.findMany({
      where: {
        orderId: orderIdValue,
        ...(orderItemId ? { orderItemId } : {}),
        status: includeFrozen
          ? { in: ['active', 'refund_pending'] }
          : 'active',
        deletedAt: null,
      },
      select: { id: true },
    });
    return packages.map((item) => item.id);
  }
}
