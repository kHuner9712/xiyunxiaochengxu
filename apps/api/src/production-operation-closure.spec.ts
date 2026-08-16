import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../../..');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('production operation closure contracts', () => {
  it('holds paid group orders before fulfillment and exposes the paid state to the mini app', () => {
    const payment = read('apps/api/src/payment/production-payment.service.ts');
    const orderApi = read('apps/miniprogram/src/api/order.ts');
    const payResult = read('apps/miniprogram/src/pages/order/pay-result.vue');

    expect(payment).toContain('OrderStatus.paid');
    expect(payment).toContain('productionGroupBuyService.handlePaymentSuccess');
    expect(orderApi).toContain("| 'paid'");
    expect(payResult).toContain("orderInfo?.status === 'paid'");
    expect(payResult).toContain("orderInfo?.status === 'pending_pickup'");
  });

  it('uses the configured product fulfillment mode for group-buy and flash-sale checkout', () => {
    const checkout = read('apps/api/src/order/promotion-checkout.service.ts');
    const fulfillment = read('apps/miniprogram/src/utils/promotion-fulfillment.ts');
    const groupDetail = read('apps/miniprogram/src/pages/group-buy/detail.vue');
    const groupPage = read('apps/miniprogram/src/pages/group-buy/group.vue');
    const flashDetail = read('apps/miniprogram/src/pages/flash-sale/detail.vue');

    expect(checkout).toContain('productFulfillmentType !== fulfillmentType');
    expect(checkout).toContain("productFulfillmentType !== 'delivery' && productFulfillmentType !== 'pickup'");
    expect(fulfillment).toContain('getProductDetail(productId)');
    expect(fulfillment).toContain("fulfillmentType === 'pickup'");
    expect(groupDetail).toContain('resolvePromotionFulfillment');
    expect(groupPage).toContain('resolvePromotionFulfillment');
    expect(flashDetail).toContain('resolvePromotionFulfillment');
  });

  it('does not force a WeChat payment for zero-pay promotion orders', () => {
    const groupApi = read('apps/miniprogram/src/api/group-buy.ts');
    const flashApi = read('apps/miniprogram/src/api/flash-sale.ts');
    const groupDetail = read('apps/miniprogram/src/pages/group-buy/detail.vue');
    const groupPage = read('apps/miniprogram/src/pages/group-buy/group.vue');
    const flashDetail = read('apps/miniprogram/src/pages/flash-sale/detail.vue');

    expect(groupApi).toContain('isZeroPay: boolean');
    expect(flashApi).toContain('isZeroPay: boolean');
    expect(groupDetail).toContain('if (result.isZeroPay)');
    expect(groupPage).toContain('if (result.isZeroPay)');
    expect(flashDetail).toContain('if (result.isZeroPay)');
  });

  it('routes shared group participation to the exact group instead of back to the activity list', () => {
    const groupPage = read('apps/miniprogram/src/pages/group-buy/group.vue');

    expect(groupPage).toContain('groupBuyApi.join');
    expect(groupPage).toContain('groupId: targetGroupId');
    expect(groupPage).not.toContain('参与此团\n        </button>\n      </view>\n      <button');
  });

  it('keeps refund side effects closed for paid and zero-pay orders', () => {
    const payment = read('apps/api/src/payment/production-payment.service.ts');
    const pointConservation = read('apps/api/src/payment/point-conserving-payment.service.ts');
    const zeroPay = read('apps/api/src/payment/zero-pay-aftersale-payment.service.ts');
    const benefits = read('apps/api/src/benefit-package/production-benefit-package.service.ts');
    const zeroPayBenefits = read('apps/api/src/benefit-package/zero-pay-aware-benefit-package.service.ts');
    const settlement = read('apps/api/src/merchant-settlement/production-merchant-settlement.service.ts');

    expect(payment).toContain('revokeAfterRefundSuccess');
    expect(payment).toContain('reverseSalesCommissionAfterRefund');
    expect(payment).toContain('handleRefundSuccess');
    expect(pointConservation).toContain('reconcileRefundPointConservation');
    expect(pointConservation).toContain('outstandingRewardClawback');
    expect(pointConservation).toContain('refund_points_conservation');
    expect(zeroPay).toContain('0元订单售后结算成功，无需调用微信退款');
    expect(zeroPay).toContain('reconcileZeroPayRefundPoints');
    expect(zeroPay).toContain('zero_refund_points_conservation');
    expect(benefits).toContain("status: 'refund_pending'");
    expect(benefits).toContain("data: { status: 'refunded' }");
    expect(zeroPayBenefits).toContain("refundAmount !== 0");
    expect(settlement).toContain('sales_referral_refund_debt');
  });

  it('uses the outermost hardened runtime providers rather than leaving safety wrappers unused', () => {
    const paymentModule = read('apps/api/src/payment/payment.module.ts');
    const activeAftersaleSafePayment = read('apps/api/src/payment/active-aftersale-safe-payment.service.ts');
    const confirmedMissingRefundPayment = read('apps/api/src/payment/confirmed-missing-refund-retry-payment.service.ts');
    const orphanSafePayment = read('apps/api/src/payment/orphan-safe-member-growth-payment.service.ts');
    const memberGrowthPayment = read('apps/api/src/payment/member-growth-conserving-payment.service.ts');
    const promotionRecoveringPayment = read('apps/api/src/payment/promotion-recovering-durable-zero-pay-aftersale-payment.service.ts');
    const durableZeroPayPayment = read('apps/api/src/payment/durable-zero-pay-aftersale-payment.service.ts');
    const historicalReconcile = read('apps/api/src/payment/historical-anomaly-payment-reconcile.service.ts');
    const orderModule = read('apps/api/src/order/order.module.ts');
    const pickupSafeOrder = read('apps/api/src/order/pickup-safe-order.service.ts');
    const pickupSafePromotion = read('apps/api/src/order/pickup-safe-promotion-checkout.service.ts');
    const idempotentOrder = read('apps/api/src/order/idempotent-attribution-safe-member-benefit-order.service.ts');
    const attributionSafeOrder = read('apps/api/src/order/attribution-safe-member-benefit-order.service.ts');
    const attributionAwarePromotion = read('apps/api/src/order/attribution-aware-promotion-checkout.service.ts');
    const memberBenefitOrder = read('apps/api/src/order/member-benefit-production-order.service.ts');
    const netRewardOrder = read('apps/api/src/order/cancellation-safe-production-order.service.ts');
    const aftersaleModule = read('apps/api/src/aftersale/aftersale.module.ts');
    const transitionSafeAftersale = read('apps/api/src/aftersale/transition-safe-return-destination-aftersale.service.ts');
    const returnDestinationAftersale = read('apps/api/src/aftersale/return-destination-view-aftersale.service.ts');
    const attachmentSafeAftersale = read('apps/api/src/aftersale/attachment-safe-production-aftersale.service.ts');
    const groupModule = read('apps/api/src/group-buy/group-buy.module.ts');
    const flashModule = read('apps/api/src/flash-sale/flash-sale.module.ts');
    const benefitModule = read('apps/api/src/benefit-package/benefit-package.module.ts');
    const durableBenefits = read('apps/api/src/benefit-package/durable-admin-benefit-package.service.ts');
    const validitySafeBenefits = read('apps/api/src/benefit-package/validity-safe-snapshot-view-benefit-package.service.ts');
    const snapshotViewBenefits = read('apps/api/src/benefit-package/snapshot-view-benefit-package.service.ts');
    const versionedBenefits = read('apps/api/src/benefit-package/versioned-benefit-package.service.ts');
    const settlementModule = read('apps/api/src/merchant-settlement/merchant-settlement.module.ts');
    const snapshotTemporalSettlement = read('apps/api/src/merchant-settlement/snapshot-temporal-rule-merchant-settlement.service.ts');
    const temporalSettlement = read('apps/api/src/merchant-settlement/temporal-rule-merchant-settlement.service.ts');
    const serializedSettlement = read('apps/api/src/merchant-settlement/serialized-sales-merchant-settlement.service.ts');
    const snapshotSettlement = read('apps/api/src/merchant-settlement/snapshot-aware-state-safe-merchant-settlement.service.ts');
    const shareModule = read('apps/api/src/share/share.module.ts');
    const atomicShare = read('apps/api/src/share/atomic-share-production.service.ts');
    const authModule = read('apps/api/src/auth/auth.module.ts');
    const recoveringAuth = read('apps/api/src/auth/recovering-production-auth.service.ts');

    expect(paymentModule).toContain('useClass: ActiveAftersaleSafePaymentService');
    expect(activeAftersaleSafePayment).toContain('extends ConfirmedMissingRefundRetryPaymentService');
    expect(activeAftersaleSafePayment).toContain('override async processWechatRefundSuccess');
    expect(activeAftersaleSafePayment).toContain('reconcileActiveAftersaleOrderStates');
    expect(confirmedMissingRefundPayment).toContain('extends OrphanSafeMemberGrowthPaymentService');
    expect(orphanSafePayment).toContain('extends MemberGrowthConservingPaymentService');
    expect(orphanSafePayment).toContain("return { code: 'FAIL', message: '本地退款记录不存在，请重试' }");
    expect(memberGrowthPayment).toContain('extends PromotionRecoveringDurableZeroPayAftersalePaymentService');
    expect(promotionRecoveringPayment).toContain('extends DurableZeroPayAftersalePaymentService');
    expect(durableZeroPayPayment).toContain('extends ZeroPayAftersalePaymentService');
    expect(memberGrowthPayment).toContain('refund_growth_conservation');
    expect(paymentModule).toContain('HistoricalAnomalyPaymentReconcileService');
    expect(historicalReconcile).toContain('extends ProductionPaymentReconcileService');

    expect(authModule).toContain('useClass: RecoveringProductionAuthService');
    expect(recoveringAuth).toContain('extends ProductionAuthService');

    expect(orderModule).toContain('useClass: PickupSafeIdempotentAttributionSafeMemberBenefitOrderService');
    expect(pickupSafeOrder).toContain('extends IdempotentAttributionSafeMemberBenefitOrderService');
    expect(pickupSafeOrder).toContain('installPickupStoreTransactionGuard');
    expect(idempotentOrder).toContain('extends AttributionSafeMemberBenefitOrderService');
    expect(idempotentOrder).toContain('buildDeterministicOrderNo');
    expect(idempotentOrder).toContain('orderCreateIdempotency');
    expect(attributionSafeOrder).toContain('extends MemberBenefitProductionOrderService');
    expect(attributionSafeOrder).toContain('resolveCreateOrderAttribution');
    expect(memberBenefitOrder).toContain('extends CancellationSafeProductionOrderService');
    expect(memberBenefitOrder).toContain('calculateMemberDiscountAmount');
    expect(memberBenefitOrder).toContain('calculateMemberRewardPoints');
    expect(netRewardOrder).toContain('status: REFUND_STATUS.SUCCESS');
    expect(netRewardOrder).toContain('successfulRefundAmount');
    expect(netRewardOrder).toContain('netPayAmount');
    expect(orderModule).toContain('provide: PromotionCheckoutService');
    expect(orderModule).toContain('useClass: PickupSafeAttributionAwarePromotionCheckoutService');
    expect(pickupSafePromotion).toContain('extends AttributionAwarePromotionCheckoutService');
    expect(pickupSafePromotion).toContain('lockActivePickupStore');
    expect(attributionAwarePromotion).toContain('extends PromotionCheckoutService');
    expect(attributionAwarePromotion).toContain('resolveCreateOrderAttribution');

    expect(aftersaleModule).toContain('useClass: TransitionSafeReturnDestinationAftersaleService');
    expect(aftersaleModule).toContain('AftersaleReviewService');
    expect(transitionSafeAftersale).toContain('extends ReturnDestinationViewAftersaleService');
    expect(transitionSafeAftersale).toContain('override async cancel');
    expect(transitionSafeAftersale).toContain('override async reject');
    expect(transitionSafeAftersale).toContain('override async fillReturnLogistics');
    expect(transitionSafeAftersale).toContain('status: AftersaleStatus.pending_review');
    expect(returnDestinationAftersale).toContain('extends AttachmentSafeProductionAftersaleService');
    expect(returnDestinationAftersale).toContain('override async fillReturnLogistics');
    expect(attachmentSafeAftersale).toContain('extends ProductionAftersaleService');
    expect(groupModule).toContain('ProductionGroupBuyService');
    expect(flashModule).toContain('ProductionFlashSaleService');
    expect(benefitModule).toContain('DurableAdminBenefitPackageService');
    expect(benefitModule).toContain('useExisting: DurableAdminBenefitPackageService');
    expect(durableBenefits).toContain('extends ValiditySafeSnapshotViewBenefitPackageService');
    expect(validitySafeBenefits).toContain('extends SnapshotViewBenefitPackageService');
    expect(validitySafeBenefits).toContain('权益尚未生效');
    expect(snapshotViewBenefits).toContain('extends VersionedBenefitPackageService');
    expect(versionedBenefits).toContain('extends ZeroPayAwareBenefitPackageService');
    expect(settlementModule).toContain('useClass: SnapshotTemporalRuleMerchantSettlementService');
    expect(snapshotTemporalSettlement).toContain('extends TemporalRuleMerchantSettlementService');
    expect(snapshotTemporalSettlement).toContain('benefitValueSource');
    expect(temporalSettlement).toContain('extends SerializedSalesMerchantSettlementService');
    expect(temporalSettlement).toContain('salesOccurredAt');
    expect(serializedSettlement).toContain('extends SnapshotAwareStateSafeMerchantSettlementService');
    expect(serializedSettlement).toContain('merchant:settlement:sales:');
    expect(snapshotSettlement).toContain('extends StateSafeProductionMerchantSettlementService');
    expect(shareModule).toContain('useClass: AtomicShareProductionService');
    expect(atomicShare).toContain('extends SafeShareProductionService');
  });

  it('makes production deployment identity and restored-backup migration verification mandatory', () => {
    const deploy = read('deploy/scripts/deploy-production.sh');
    const smoke = read('deploy/scripts/smoke-runtime.sh');
    const compose = read('deploy/docker-compose.yml');

    expect(deploy).toContain("CURRENT_BRANCH=\"$(git branch --show-current)\"");
    expect(deploy).toContain("[ \"$CURRENT_BRANCH\" = 'main' ]");
    expect(deploy).toContain('EXPECTED_DEPLOY_SHA');
    expect(deploy).toContain('git fetch --quiet origin main');
    expect(deploy).toContain('FULL_SHA="$(git rev-parse HEAD)"');
    expect(deploy).toContain('SHORT_SHA="$(git rev-parse --short HEAD)"');
    expect(deploy).toContain('BUILD_SHA="$FULL_SHA"');
    expect(deploy).toContain('mysql-before-${SHORT_SHA}-${DEPLOY_TIME}.sql.gz');
    expect(deploy).toContain('rollback-${SHORT_SHA}-${DEPLOY_TIME}');
    expect(deploy).toContain('production backup restored into disposable migration clone');
    expect(deploy).toContain('npx prisma migrate deploy');
    expect(smoke).toContain('^[0-9a-fA-F]{40}$');
    expect(smoke).toContain('API runtime build SHA mismatch');
    expect(smoke).toContain('API/admin build identity mismatch');
    expect(compose).toContain('${DATABASE_URL:?DATABASE_URL required}');
  });
});
