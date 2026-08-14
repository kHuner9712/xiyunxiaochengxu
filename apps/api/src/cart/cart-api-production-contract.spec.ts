import { readFileSync } from 'fs';
import { resolve } from 'path';

const cartApiPath = resolve(__dirname, '../../../miniprogram/src/api/cart.ts');

function readCartApi() {
  return readFileSync(cartApiPath, 'utf8');
}

describe('miniprogram cart API production contract', () => {
  it('keeps incremental add-to-cart on persistent idempotency even outside the Pinia store', () => {
    const source = readCartApi();

    expect(source).toContain("import { runPersistentIdempotentAction } from '@/utils/checkout-idempotency'");
    expect(source).toContain('`cart:add:${data.skuId}`');
    expect(source).toContain("post<CartItem>('/weapp/cart/add', { ...data, clientRequestId })");
  });

  it('matches the backend remove-selected route', () => {
    const source = readCartApi();

    expect(source).toContain("del('/weapp/cart/remove-selected')");
    expect(source).not.toContain("del('/weapp/cart/delete-selected')");
  });
});
