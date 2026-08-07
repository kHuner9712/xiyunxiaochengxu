import { Injectable } from '@nestjs/common';
import { MerchantSettlementService } from '../merchant-settlement/merchant-settlement.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { ProductionBenefitPackageService } from './production-benefit-package.service';

@Injectable()
export class SnapshotGuardedProductionBenefitPackageService extends ProductionBenefitPackageService {
  constructor(
    private readonly snapshotPrisma: PrismaService,
    merchantSettlementService: MerchantSettlementService,
  ) {
    super(snapshotPrisma, merchantSettlementService);
  }

  override async grantBenefitsForOrder(orderId: string | bigint, userId: string | bigint) {
    await this.assertBenefitConfigurationStableSinceOrder(orderId);
    return super.grantBenefitsForOrder(orderId, userId);
  }

  override async reconcileOrderBenefits(orderId: string | bigint, userId: string | bigint) {
    await this.assertBenefitConfigurationStableSinceOrder(orderId);
    return super.reconcileOrderBenefits(orderId, userId);
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
