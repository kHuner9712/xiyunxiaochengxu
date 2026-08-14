import { readFileSync } from 'fs';
import { resolve } from 'path';

const productEditPath = resolve(__dirname, '../../../admin-web/src/views/product/edit.vue');

function source() {
  return readFileSync(productEditPath, 'utf8');
}

describe('admin product create durability contract', () => {
  it('keeps one create request id for the lifetime of the new-product page', () => {
    const text = source();

    expect(text).toContain("const createRequestId = ref('')");
    expect(text).toContain('if (!route.params.id) createRequestId.value = createProductRequestId()');
    expect(text).toContain("...(!isEdit.value ? { clientRequestId: createRequestId.value } : {})");
    expect(text).toContain("if (!createRequestId.value) throw new Error('商品创建请求标识缺失");
  });

  it('persists generated SKU codes before the first create request so retries reuse them', () => {
    const text = source();

    expect(text).toContain('function ensureStableSkuCodes()');
    expect(text).toContain('if (!sku.skuCode) sku.skuCode = generateSkuCode(form.id)');
    expect(text).toContain('ensureStableSkuCodes()');
    expect(text).toContain('skuCode: s.skuCode,');
  });

  it('freezes product editing and navigation while the save request is in flight', () => {
    const text = source();

    expect(text).toContain(':model="form" :rules="rules" label-width="140px" style="max-width: 900px" :disabled="submitting"');
    expect(text).toContain(':disabled="pendingUploads > 0 || submitting" @click="handleSubmit"');
    expect(text).toContain('<el-button :disabled="submitting" @click="router.back()">取消</el-button>');
    expect(text).toContain('async function handleSubmit() {\n  if (submitting.value) return');
  });
});
