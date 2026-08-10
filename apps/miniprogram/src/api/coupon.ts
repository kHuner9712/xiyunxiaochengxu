import { get, post } from '@/utils/request'

export function getCouponCenter(params: { page: number; pageSize: number }) {
  return get<{ list: CouponItem[]; total: number }>('/weapp/coupon/center', params)
}

/**
 * Logged-in coupon center source. The backend only returns coupons the current account can still
 * claim after member-level, new-customer, stock and per-user-limit checks.
 */
export async function getClaimableCoupons() {
  const data = await get<CouponItem[]>('/weapp/coupon/available')
  return Array.isArray(data) ? data : []
}

export function getMyCoupons(params: { status?: number; page: number; pageSize: number }) {
  return get<{ list: MyCouponItem[]; total: number }>('/weapp/coupon/my', params)
}

export function receiveCoupon(couponId: string) {
  return post(`/weapp/coupon/receive/${encodeURIComponent(couponId)}`)
}

export async function getAvailableCoupons(params: { amount: number; productIds: string[] }) {
  const data = await get<MyCouponItem[]>('/weapp/coupon/usable', {
    amount: params.amount,
    // Explicit CSV avoids platform-specific array query serialization differences.
    productIds: params.productIds.join(',')
  })
  return Array.isArray(data) ? data : []
}

export interface CouponItem {
  id: string
  name: string
  type: number
  value: number
  minAmount: number
  startTime: string
  endTime: string
  /** Public center may expose this flag; personalized /available is already claimable-only. */
  received: boolean
  remainCount: number
  description?: string
}

export interface MyCouponItem {
  id: string
  couponId: string
  name: string
  type: number
  value: number
  minAmount: number
  startTime: string
  endTime: string
  /** UI status: 1 available, 2 used, 3 expired, 4 locked by a pending order. */
  status: number
  rawStatus?: number
  useTime?: string
  usedAt?: string
  usedOrderId?: string | null
  description?: string
}