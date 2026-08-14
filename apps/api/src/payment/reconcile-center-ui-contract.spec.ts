import { readFileSync } from 'fs';
import { resolve } from 'path';

const repoRoot = resolve(__dirname, '../../../..');
const reconcileCenterPath = resolve(
  repoRoot,
  'apps/admin-web/src/views/order/reconcile-center.vue',
);

function readReconcileCenter(): string {
  return readFileSync(reconcileCenterPath, 'utf8');
}

describe('admin reconcile center production interaction contract', () => {
  it('acquires the shared fund-operation guard before opening confirmation dialogs', () => {
    const source = readReconcileCenter();

    expect(source).toContain(
      'const fundOperationBusy = computed(() => paymentLoading.value || refundLoading.value || syncLoading.value)',
    );
    expect(source).toContain(
      'async function handlePaymentReconcile() {\n  if (fundOperationBusy.value) return\n  paymentLoading.value = true',
    );
    expect(source).toContain(
      'async function handleRefundReconcile() {\n  if (fundOperationBusy.value) return\n  refundLoading.value = true',
    );
    expect(source).toContain(
      'async function handleSyncRefund() {\n  if (fundOperationBusy.value) return',
    );
  });

  it('keeps compensation resolution single-flight at the function boundary', () => {
    const source = readReconcileCenter();

    expect(source).toContain(
      'async function submitResolve() {\n  if (resolveSubmitting.value || !currentTask.value) return',
    );
    expect(source).toContain(':disabled="resolveSubmitting" @click="submitResolve"');
  });

  it('ignores stale compensation-list responses after a newer query starts', () => {
    const source = readReconcileCenter();

    expect(source).toContain('let compensationFetchVersion = 0');
    expect(source).toContain('const requestVersion = ++compensationFetchVersion');
    expect(source).toContain('if (requestVersion !== compensationFetchVersion) return');
    expect(source).toContain('if (requestVersion === compensationFetchVersion) {');
  });
});
