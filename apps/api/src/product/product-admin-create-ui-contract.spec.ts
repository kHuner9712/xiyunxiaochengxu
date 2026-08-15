import { readFileSync } from 'fs';
import { resolve } from 'path';

const productEditPath = resolve(__dirname, '../../../admin-web/src/views/product/edit.vue');

function source() {
  return readFileSync(productEditPath, 'utf8');
}

describe('admin product create durability contract', () => {
  it('keeps one create request id per new-product route generation', () => {
    const text = source();

    expect(text).toContain("const createRequestId = ref('')");
    expect(text).toContain('() => currentRouteProductId(),');
    expect(text).toContain("if (!nextProductId) {\n      createRequestId.value = createProductRequestId()\n      return\n    }");
    expect(text).toContain("createRequestId.value = ''");
    expect(text).toContain("...(!targetIsEdit ? { clientRequestId: createRequestId.value } : {})");
    expect(text).toContain("if (!createRequestId.value) throw new Error('商品创建请求标识缺失");
  });

  it('persists generated SKU codes before the first create request so retries reuse them', () => {
    const text = source();

    expect(text).toContain('function ensureStableSkuCodes()');
    expect(text).toContain('if (!sku.skuCode) sku.skuCode = generateSkuCode(form.id)');
    expect(text).toContain('ensureStableSkuCodes()');
    expect(text).toContain('skuCode: s.skuCode,');
  });

  it('freezes local editing and binds saves to the current product route generation', () => {
    const text = source();

    expect(text).toContain(':model="form" :rules="rules" label-width="140px" style="max-width: 900px" :disabled="submitting || invalidRoute"');
    expect(text).toContain(':disabled="pendingUploads > 0 || submitting || editorLoading || invalidRoute" @click="handleSubmit"');
    expect(text).toContain('<el-button :disabled="submitting" @click="router.back()">取消</el-button>');
    expect(text).toContain('async function handleSubmit() {\n  if (submitting.value || editorLoading.value) return');
    expect(text).toContain('const targetProductId = currentRouteProductId()');
    expect(text).toContain('const operationGeneration = editorGeneration');
    expect(text).toContain('if (!isCurrentEditor(operationGeneration, targetProductId)) {');
    expect(text).toContain('await productApi.update(targetProductId, payload)');
  });
});
