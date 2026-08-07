import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { MerchantSettlementService } from '../merchant-settlement/merchant-settlement.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { BenefitPackageService } from './benefit-package.service';

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

  async freezeForRefund(orderId: bigint | string, aftersaleId?: bigint | string | null) {
    const packageIds = await this.findAffectedPackageIds(orderId, aftersaleId);
    if (packageIds.length === 0) return { affected: 0 };

    await this.assertRefundable(orderId, aftersaleId);
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
    const packageIds = await this.findAffectedPackageIds(orderId, aftersaleId);
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
    const packageIds = await this.findAffectedPackageIds(orderId, aftersaleId);
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

  private async findAffectedPackageIds(
    orderId: bigint | string,
    aftersaleId?: bigint | string | null,
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
        status: { in: ['active', 'refund_pending'] },
        deletedAt: null,
      },
      select: { id: true },
    });
    return packages.map((item) => item.id);
  }
}
