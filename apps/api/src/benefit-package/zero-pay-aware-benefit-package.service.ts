import { Injectable } from '@nestjs/common';
import { MerchantSettlementService } from '../merchant-settlement/merchant-settlement.service';
import { ProductionMerchantSettlementService } from '../merchant-settlement/production-merchant-settlement.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { parsePositiveBigIntId } from '../common/utils/bigint-id';
import { SnapshotGuardedProductionBenefitPackageService } from './snapshot-guarded-production-benefit-package.service';

interface ZeroPayAwareBenefitPackageServiceContract {
  findAll(...args: any[]): Promise<any>;
  findById(...args: any[]): Promise<any>;
  findDetailForWeapp(...args: any[]): Promise<any>;
  findByProductId(...args: any[]): Promise<any>;
  create(...args: any[]): Promise<any>;
  update(...args: any[]): Promise<any>;
  updateStatus(...args: any[]): Promise<any>;
  delete(...args: any[]): Promise<any>;
  findUserPackages(...args: any[]): Promise<any>;
  findMyPackages(...args: any[]): Promise<any>;
  findEntitlements(...args: any[]): Promise<any>;
  findMyEntitlements(...args: any[]): Promise<any>;
  findEntitlementForUser(...args: any[]): Promise<any>;
  previewVerify(...args: any[]): Promise<any>;
  verify(...args: any[]): Promise<any>;
  findVerificationLogs(...args: any[]): Promise<any>;
  getStats(...args: any[]): Promise<any>;
  grantBenefitsForOrder(...args: any[]): Promise<any>;
  reconcileOrderBenefits(...args: any[]): Promise<any>;
  reconcileUsedEntitlementAuditGaps(...args: any[]): Promise<any>;
  assertRefundable(...args: any[]): Promise<any>;
  assertRefundAmountSupported(...args: any[]): Promise<any>;
  freezeForRefund(...args: any[]): Promise<any>;
  restoreAfterRefundClosed(...args: any[]): Promise<any>;
  revokeAfterRefundSuccess(...args: any[]): Promise<any>;
}

@Injectable()
class ZeroPayAwareBenefitPackageServiceRuntime extends SnapshotGuardedProductionBenefitPackageService {
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

export type ZeroPayAwareBenefitPackageService = ZeroPayAwareBenefitPackageServiceContract;

export const ZeroPayAwareBenefitPackageService =
  ZeroPayAwareBenefitPackageServiceRuntime as unknown as new (
    zeroPayBenefitPrisma: PrismaService,
    merchantSettlementService: MerchantSettlementService,
  ) => ZeroPayAwareBenefitPackageServiceContract;
