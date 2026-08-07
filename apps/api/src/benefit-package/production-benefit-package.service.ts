import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { MerchantSettlementService } from '../merchant-settlement/merchant-settlement.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { BenefitPackageService } from './benefit-package.service';
import { calculateOrderItemRefundCap } from '../common/utils/refund-amount';

@Injectable()
export class ProductionBenefitPackageService extends BenefitPackageService {
  private readonly productionLogger = new Logger(ProductionBenefitPackageService.name);

  constructor(
    private readonly productionPrisma: PrismaService,
    merchantSettlementService: MerchantSettlementService,
  ) {
    super(productionPrisma, merchantSettlementService);
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
   * 补偿微信退款 CLOSED/ABNORMAL 后仍被冻结的权益。
   * 只处理同一订单/售后单“最新一笔退款”已经进入失败终态的情况，
   * 避免旧退款失败但新退款仍在处理中时误解冻。
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

        if (refund.status === 'closed' || refund.status === 'abnormal') {
          const result = await this.restoreAfterRefundClosed(
            refund.orderId,
            refund.aftersaleId,
          );
          restored += result.affected;
        }
      }
    }

    return { orders: frozen.length, restored, skipped };
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
