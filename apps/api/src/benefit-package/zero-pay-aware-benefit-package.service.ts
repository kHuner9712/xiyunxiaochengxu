import { Injectable } from '@nestjs/common';
import { MerchantSettlementService } from '../merchant-settlement/merchant-settlement.service';
import { ProductionMerchantSettlementService } from '../merchant-settlement/production-merchant-settlement.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { SnapshotGuardedProductionBenefitPackageService } from './snapshot-guarded-production-benefit-package.service';

@Injectable()
export class ZeroPayAwareBenefitPackageService extends SnapshotGuardedProductionBenefitPackageService {
  constructor(
    private readonly zeroPayBenefitPrisma: PrismaService,
    merchantSettlementService: MerchantSettlementService,
  ) {
    super(
      zeroPayBenefitPrisma,
      merchantSettlementService as ProductionMerchantSettlementService,
    );
  }

  override async freezeForRefund(
    orderId: bigint | string,
    aftersaleId?: bigint | string | null,
  ) {
    if (!aftersaleId) return super.freezeForRefund(orderId, aftersaleId);

    const orderIdValue = parsePositiveBigIntId(orderId, '订单');
    const aftersaleIdValue = parsePositiveBigIntId(aftersaleId, '售后单');
    const aftersale = await this.zeroPayBenefitPrisma.aftersaleOrder.findFirst({
      where: { id: aftersaleIdValue, orderId: orderIdValue },
      select: { orderItemId: true, refundAmount: true },
    });
    if (!aftersale || aftersale.refundAmount !== 0) {
      return super.freezeForRefund(orderIdValue, aftersaleIdValue);
    }

    await this.assertRefundable(orderIdValue, aftersaleIdValue);
    await this.assertRefundAmountSupported(orderIdValue, aftersaleIdValue, 0);

    const result = await this.zeroPayBenefitPrisma.userBenefitPackage.updateMany({
      where: {
        orderId: orderIdValue,
        orderItemId: aftersale.orderItemId,
        status: 'active',
        deletedAt: null,
      },
      data: { status: 'refund_pending' },
    });
    return { affected: result.count };
  }
}
