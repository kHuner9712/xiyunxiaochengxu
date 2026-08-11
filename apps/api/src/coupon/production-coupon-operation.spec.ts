import { CouponService } from './coupon.service';
import { ProductionOrderService } from '../order/production-order.service';

describe('production coupon semantics', () => {
  it('keeps legacy applicable-id arrays compatible with new metadata envelopes', () => {
    const coupon = new CouponService({} as any);
    expect(coupon.parseApplicableIds('["12","9007199254740993"]')).toEqual([
      '12',
      '9007199254740993',
    ]);
    expect(
      coupon.parseApplicableIds(
        JSON.stringify({ ids: ['12', '9007199254740993'], description: '仅指定商品' }),
      ),
    ).toEqual(['12', '9007199254740993']);
  });

  it('serializes coupon description without changing the applicable-id contract', () => {
    const coupon = new CouponService({} as any);
    const serialized = (coupon as any).serializeCoupon({
      id: 1n,
      memberLevelId: null,
      applicableIds: JSON.stringify({ ids: ['99'], description: '限测试商品' }),
      discountLimit: 0,
    });
    expect(serialized.id).toBe('1');
    expect(serialized.applicableIds).toEqual(['99']);
    expect(serialized.description).toBe('限测试商品');
  });

  it('type-3 no-threshold coupon actually reduces the order amount', () => {
    const service = createOrderService();
    expect((service as any).calculateProductionCouponAmount({ type: 3, value: 500 }, 1200)).toBe(500);
    expect((service as any).calculateProductionCouponAmount({ type: 3, value: 500 }, 300)).toBe(300);
  });

  it('product-scoped coupons require every checkout product to be in scope', () => {
    const service = createOrderService();
    const eligible = (service as any).couponScopeMatches(
      { applicableType: 2, applicableIds: JSON.stringify({ ids: ['100'], description: '' }) },
      [
        { productId: 100n, product: { categoryId: 10n } },
        { productId: 100n, product: { categoryId: 10n } },
      ],
    );
    const mixed = (service as any).couponScopeMatches(
      { applicableType: 2, applicableIds: JSON.stringify({ ids: ['100'], description: '' }) },
      [
        { productId: 100n, product: { categoryId: 10n } },
        { productId: 101n, product: { categoryId: 10n } },
      ],
    );
    expect(eligible).toBe(true);
    expect(mixed).toBe(false);
  });

  it('category-scoped coupons reject products without an allowed category', () => {
    const service = createOrderService();
    expect(
      (service as any).couponScopeMatches(
        { applicableType: 1, applicableIds: '["10"]' },
        [{ productId: 100n, product: { categoryId: 10n } }],
      ),
    ).toBe(true);
    expect(
      (service as any).couponScopeMatches(
        { applicableType: 1, applicableIds: '["10"]' },
        [{ productId: 100n, product: { categoryId: 11n } }],
      ),
    ).toBe(false);
  });
});

function createOrderService() {
  const prisma: any = {
    order: { count: jest.fn() },
    groupBuyMember: { findMany: jest.fn() },
  };
  return new ProductionOrderService(
    prisma,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );
}
