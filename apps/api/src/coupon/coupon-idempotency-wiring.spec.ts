import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../../../..');

function read(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('coupon receive idempotency runtime wiring', () => {
  it('keeps the idempotent receive service token bound to the durable final CouponService provider', () => {
    const moduleSource = read('apps/api/src/coupon/coupon.module.ts');
    expect(moduleSource).toContain('DurableAdminCouponService');
    expect(moduleSource).toContain('{ provide: IdempotentGrowthAwareCouponService, useExisting: DurableAdminCouponService }');
    expect(moduleSource).toContain('{ provide: CouponService, useExisting: DurableAdminCouponService }');
    expect(moduleSource).toContain('RedisModule');
  });

  it('requires a client request identity on the real receive endpoint', () => {
    const controllerSource = read('apps/api/src/coupon/coupon.controller.ts');
    const dtoSource = read('apps/api/src/coupon/dto/receive-coupon.dto.ts');
    expect(controllerSource).toContain('@Body() body: ReceiveCouponDto');
    expect(controllerSource).toContain('receiveIdempotent(userId, couponId, body.clientRequestId)');
    expect(dtoSource).toContain('clientRequestId!: string');
  });

  it('persists the same client identity across miniapp network retries', () => {
    const apiSource = read('apps/miniprogram/src/api/coupon.ts');
    expect(apiSource).toContain('runPersistentIdempotentAction');
    expect(apiSource).toContain('`coupon:receive:${couponId}`');
    expect(apiSource).toContain('{ clientRequestId }');
  });
});
