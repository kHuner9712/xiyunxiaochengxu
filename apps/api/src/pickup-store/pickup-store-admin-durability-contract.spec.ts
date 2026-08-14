import { readFileSync } from 'fs';
import { resolve } from 'path';

const apiPath = resolve(__dirname, '../../../admin-web/src/api/pickup-store.ts');
const listPath = resolve(__dirname, '../../../admin-web/src/views/pickup-store/list.vue');

function read(path: string) { return readFileSync(path, 'utf8'); }

describe('pickup store admin mutation durability contracts', () => {
  it('keeps one pending create request id across ambiguous network failures', () => {
    const text = read(apiPath);
    expect(text).toContain("const PENDING_PICKUP_STORE_CREATE_KEY = 'baby_mall_admin_pending_pickup_store_create_request_id'");
    expect(text).toContain('const clientRequestId = getOrCreatePickupStoreCreateRequestId()');
    expect(text).toContain("request.post('/admin/pickup-store', { ...data, clientRequestId })");
    expect(text).toContain('if (status >= 400 && status < 500)');
    expect(text).toContain("runSingleFlight(`admin:pickup-store:delete:${id}`");
  });

  it('uses one busy lock for status/delete and freezes the dialog while saving', () => {
    const text = read(listPath);
    expect(text).toContain('const actionBusyIds = reactive(new Set<string>())');
    expect(text).toContain('if (!id || submitting.value || actionBusyIds.has(id)) return');
    expect(text).toContain(':close-on-click-modal="!submitting"');
    expect(text).toContain(':close-on-press-escape="!submitting"');
    expect(text).toContain(':show-close="!submitting"');
    expect(text).toContain(':disabled="submitting"');
    expect(text).toContain('const requestSeq = ++listLoadSeq');
  });
});
