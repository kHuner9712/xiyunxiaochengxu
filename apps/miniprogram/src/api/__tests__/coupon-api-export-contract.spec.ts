import { describe, expect, it } from 'vitest'
import {
  getAvailableCoupons,
  getClaimableCoupons,
  getCouponCenter,
  getMyCoupons,
  getUsableCoupons,
  receiveCoupon,
} from '../coupon'

describe('coupon API export contract', () => {
  it('keeps the coupon exports consumed by center and order-confirm pages', () => {
    expect(getCouponCenter).toBeTypeOf('function')
    expect(getClaimableCoupons).toBeTypeOf('function')
    expect(getMyCoupons).toBeTypeOf('function')
    expect(receiveCoupon).toBeTypeOf('function')
    expect(getAvailableCoupons).toBeTypeOf('function')
    expect(getUsableCoupons).toBeTypeOf('function')
  })
})
