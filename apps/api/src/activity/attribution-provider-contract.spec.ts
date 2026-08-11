import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../../../..');

function read(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('activity attribution provider contract', () => {
  it('keeps idempotency outside attribution safety and quota safety without bypassing either layer', () => {
    const moduleSource = read('apps/api/src/activity/activity.module.ts');
    const idempotentSource = read(
      'apps/api/src/activity/idempotent-attribution-safe-quota-activity-multi-item-checkout.service.ts',
    );
    const attributionSource = read(
      'apps/api/src/activity/attribution-safe-quota-activity-multi-item-checkout.service.ts',
    );

    expect(moduleSource).toContain('provide: ActivityMultiItemCheckoutService');
    expect(moduleSource).toContain(
      'useClass: IdempotentAttributionSafeQuotaActivityMultiItemCheckoutService',
    );
    expect(idempotentSource).toContain(
      'extends AttributionSafeQuotaActivityMultiItemCheckoutService',
    );
    expect(idempotentSource).toContain('return await this.idempotencyStorage.run(');
    expect(attributionSource).toContain('extends QuotaSafeActivityMultiItemCheckoutService');
    expect(attributionSource).toContain('resolveCreateOrderAttribution');
    expect(attributionSource).toContain('return super.createOrder(');
  });
});
