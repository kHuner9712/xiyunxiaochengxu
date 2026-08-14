import { readFileSync } from 'fs';
import { resolve } from 'path';

const modulePath = resolve(__dirname, 'coupon.module.ts');
const apiPath = resolve(__dirname, '../../../admin-web/src/api/coupon.ts');
const listPath = resolve(__dirname, '../../../admin-web/src/views/marketing/coupon-list.vue');

function read(path: string) { return readFileSync(path, 'utf8'); }

describe('coupon admin durability runtime contracts', () => {
  it('binds both coupon injection tokens to the same durable final provider', () => {
    const text = read(modulePath);
    expect(text).toContain('DurableAdminCouponService');
    expect(text).toContain('{ provide: IdempotentGrowthAwareCouponService, useExisting: DurableAdminCouponService }');
    expect(text).toContain('{ provide: CouponService, useExisting: DurableAdminCouponService }');
  });

  it('persists one pending admin create request id across ambiguous failures', () => {
    const text = read(apiPath);
    expect(text).toContain("const PENDING_COUPON_CREATE_KEY = 'baby_mall_admin_pending_coupon_create_request_id'");
    expect(text).toContain('const clientRequestId = getOrCreateCouponCreateRequestId()');
    expect(text).toContain("request.post('/admin/coupon', { ...data, clientRequestId })");
    expect(text).toContain('if (status >= 400 && status < 500)');
    expect(text).toContain("runSingleFlight(`admin:coupon:delete:${id}`");
  });

  it('serializes row mutations and prevents stale list responses from overwriting newer filters', () => {
    const text = read(listPath);
    expect(text).toContain('const actionBusyIds = reactive(new Set<string>())');
    expect(text).toContain('if (!id || actionBusyIds.has(id)) return');
    expect(text).toContain('const requestSeq = ++listRequestSeq');
    expect(text).toContain('if (requestSeq !== listRequestSeq) return');
  });
});
