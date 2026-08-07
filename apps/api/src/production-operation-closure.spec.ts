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

  it('keeps refund side effects closed for benefits, settlement and group-buy compensation', () => {
    const payment = read('apps/api/src/payment/production-payment.service.ts');
    const benefits = read('apps/api/src/benefit-package/production-benefit-package.service.ts');
    const settlement = read('apps/api/src/merchant-settlement/production-merchant-settlement.service.ts');

    expect(payment).toContain('revokeAfterRefundSuccess');
    expect(payment).toContain('reverseSalesCommissionAfterRefund');
    expect(payment).toContain('handleRefundSuccess');
    expect(benefits).toContain("status: 'refund_pending'");
    expect(benefits).toContain("data: { status: 'refunded' }");
    expect(settlement).toContain('sales_referral_refund_debt');
  });

  it('uses the outermost hardened runtime providers rather than leaving safety wrappers unused', () => {
    const paymentModule = read('apps/api/src/payment/payment.module.ts');
    const historicalReconcile = read('apps/api/src/payment/historical-anomaly-payment-reconcile.service.ts');
    const orderModule = read('apps/api/src/order/order.module.ts');
    const aftersaleModule = read('apps/api/src/aftersale/aftersale.module.ts');
    const groupModule = read('apps/api/src/group-buy/group-buy.module.ts');
    const flashModule = read('apps/api/src/flash-sale/flash-sale.module.ts');
    const benefitModule = read('apps/api/src/benefit-package/benefit-package.module.ts');
    const settlementModule = read('apps/api/src/merchant-settlement/merchant-settlement.module.ts');
    const shareModule = read('apps/api/src/share/share.module.ts');

    expect(paymentModule).toContain('CancellationSafeStockSafePaymentService');
    expect(paymentModule).toContain('HistoricalAnomalyPaymentReconcileService');
    expect(historicalReconcile).toContain('extends ProductionPaymentReconcileService');
    expect(orderModule).toContain('CancellationSafeProductionOrderService');
    expect(aftersaleModule).toContain('ProductionAftersaleService');
    expect(groupModule).toContain('ProductionGroupBuyService');
    expect(flashModule).toContain('ProductionFlashSaleService');
    expect(benefitModule).toContain('SnapshotGuardedProductionBenefitPackageService');
    expect(settlementModule).toContain('ProductionMerchantSettlementService');
    expect(shareModule).toContain('ProductionShareService');
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