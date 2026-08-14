import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../../..');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('promotion checkout idempotency runtime wiring', () => {
  it('uses the idempotent flash-sale provider in the real module', () => {
    const moduleSource = read('apps/api/src/flash-sale/flash-sale.module.ts');
    expect(moduleSource).toContain("import { IdempotentProductionFlashSaleService } from './idempotent-production-flash-sale.service'");
    expect(moduleSource).toContain('provide: FlashSaleService');
    expect(moduleSource).toContain('useClass: IdempotentProductionFlashSaleService');
  });

  it('keeps the idempotent bigint-safe group-buy provider in the durable final runtime chain', () => {
    const moduleSource = read('apps/api/src/group-buy/group-buy.module.ts');
    const providerSource = read('apps/api/src/group-buy/durable-admin-idempotent-bigint-safe-production-group-buy.service.ts');
    expect(moduleSource).toContain("import { DurableAdminIdempotentBigintSafeProductionGroupBuyService } from './durable-admin-idempotent-bigint-safe-production-group-buy.service'");
    expect(moduleSource).toContain('provide: GroupBuyService');
    expect(moduleSource).toContain('useExisting: DurableAdminIdempotentBigintSafeProductionGroupBuyService');
    expect(providerSource).toContain("import { IdempotentBigintSafeProductionGroupBuyService } from './idempotent-bigint-safe-production-group-buy.service'");
    expect(providerSource).toContain('extends IdempotentBigintSafeProductionGroupBuyService');
  });

  it('uses the idempotent activity multi-item provider in the real module', () => {
    const moduleSource = read('apps/api/src/activity/activity.module.ts');
    expect(moduleSource).toContain("import { IdempotentAttributionSafeQuotaActivityMultiItemCheckoutService } from './idempotent-attribution-safe-quota-activity-multi-item-checkout.service'");
    expect(moduleSource).toContain('provide: ActivityMultiItemCheckoutService');
    expect(moduleSource).toContain('useClass: IdempotentAttributionSafeQuotaActivityMultiItemCheckoutService');
  });
});
