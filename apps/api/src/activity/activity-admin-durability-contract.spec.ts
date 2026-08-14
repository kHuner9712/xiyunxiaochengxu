import { readFileSync } from 'fs';
import { resolve } from 'path';

const apiPath = resolve(__dirname, '../../../admin-web/src/api/activity.ts');
const listPath = resolve(__dirname, '../../../admin-web/src/views/marketing/activity-list.vue');
const runtimePath = resolve(__dirname, 'checkout-ready-production-activity.service.ts');

function read(path: string) {
  return readFileSync(path, 'utf8');
}

describe('activity admin durability and runtime wiring contracts', () => {
  it('keeps a pending create request id across ambiguous failures', () => {
    const text = read(apiPath);

    expect(text).toContain("const PENDING_ACTIVITY_CREATE_KEY = 'baby_mall_admin_pending_activity_create_request_id'");
    expect(text).toContain('const clientRequestId = getOrCreateActivityCreateRequestId()');
    expect(text).toContain("request.post('/admin/activity', { ...data, clientRequestId })");
    expect(text).toContain('if (status >= 400 && status < 500)');
    expect(text).toContain("runSingleFlight(`admin:activity:delete:${id}`");
    expect(text).toContain("runSingleFlight(`admin:activity:status:${id}`");
  });

  it('serializes end/delete actions per activity and ignores stale list responses', () => {
    const text = read(listPath);

    expect(text).toContain('const actionBusyIds = reactive(new Set<string>())');
    expect(text).toContain('if (!id || actionBusyIds.has(id)) return');
    expect(text).toContain('actionBusyIds.add(id)');
    expect(text).toContain('actionBusyIds.delete(id)');
    expect(text).toContain('const requestSeq = ++listRequestSeq');
    expect(text).toContain('if (requestSeq !== listRequestSeq) return');
  });

  it('checks a durable create event before rerunning current-SKU validation', () => {
    const text = read(runtimePath);
    const eventCheck = text.indexOf('ACTIVITY_CREATE_EVENT')
    const validation = text.indexOf('await this.assertExecutableDefinition(data)')

    expect(eventCheck).toBeGreaterThan(-1)
    expect(validation).toBeGreaterThan(eventCheck)
    expect(text).toContain("skuIds.push(parsePositiveBigIntId(product.skuId, 'SKU'))")
  });
});
