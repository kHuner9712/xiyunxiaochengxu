import { readFileSync } from 'fs';
import { resolve } from 'path';

const supplierViewPath = resolve(__dirname, '../../../admin-web/src/views/supplier/list.vue');

function source() {
  return readFileSync(supplierViewPath, 'utf8');
}

describe('admin supplier create durability contract', () => {
  it('creates and keeps one request identity for each open create dialog', () => {
    const text = source();

    expect(text).toContain("clientRequestId: ''");
    expect(text).toContain('form.clientRequestId = createSupplierRequestId()');
    expect(text).toContain("...(!form.id ? { clientRequestId: form.clientRequestId } : {})");
    expect(text).toContain('if (!form.clientRequestId) throw new Error');
  });

  it('does not allow the create dialog to be dismissed while its request is in flight', () => {
    const text = source();

    expect(text).toContain(':close-on-click-modal="!submitting"');
    expect(text).toContain(':close-on-press-escape="!submitting"');
    expect(text).toContain(':show-close="!submitting"');
    expect(text).toContain('async function handleSubmit() {\n  if (submitting.value) return\n  submitting.value = true');
  });
});
