import { readFileSync } from 'fs';
import { resolve } from 'path';

const categoryViewPath = resolve(__dirname, '../../../admin-web/src/views/product/category.vue');

function source() {
  return readFileSync(categoryViewPath, 'utf8');
}

describe('admin category mutation durability contract', () => {
  it('keeps one create request id for each logical category create', () => {
    const text = source();

    expect(text).toContain("clientRequestId: ''");
    expect(text).toContain('form.clientRequestId = createCategoryRequestId()');
    expect(text).toContain("...(!form.id ? { clientRequestId: form.clientRequestId } : {})");
    expect(text).toContain("if (!form.clientRequestId) throw new Error('分类创建请求标识缺失");
  });

  it('freezes dialog lifecycle during upload or submit so stale async work cannot mutate a new form', () => {
    const text = source();

    expect(text).toContain('const operationBusy = computed(() => submitting.value || uploading.value)');
    expect(text).toContain(':close-on-click-modal="!operationBusy"');
    expect(text).toContain(':close-on-press-escape="!operationBusy"');
    expect(text).toContain(':show-close="!operationBusy"');
    expect(text).toContain(':model="form" :rules="rules" label-width="100px" :disabled="operationBusy"');
    expect(text).toContain('if (operationBusy.value) return');
  });
});
