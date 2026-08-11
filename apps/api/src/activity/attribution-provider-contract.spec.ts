import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../../..');

function read(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('activity attribution provider contract', () => {
  it('keeps attribution safety outside the quota-safe multi-item checkout without bypassing it', () => {
    const moduleSource = read('apps/api/src/activity/activity.module.ts');
    const wrapperSource = read(
      'apps/api/src/activity/attribution-safe-quota-activity-multi-item-checkout.service.ts',
    );

    expect(moduleSource).toContain('provide: ActivityMultiItemCheckoutService');
    expect(moduleSource).toContain('useClass: AttributionSafeQuotaActivityMultiItemCheckoutService');
    expect(wrapperSource).toContain('extends QuotaSafeActivityMultiItemCheckoutService');
    expect(wrapperSource).toContain('resolveCreateOrderAttribution');
    expect(wrapperSource).toContain('return super.createOrder(');
  });
});
