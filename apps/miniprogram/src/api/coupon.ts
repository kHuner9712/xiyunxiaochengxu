import { get, post } from '@/utils/request'

export function getCouponCenter(params: { page: number; pageSize: number }) {
  return get<{ list: CouponItem[]; total: number }>('/weapp/coupon/center', params)
}

export function getMyCoupons(params: { status?: number; page: number; pageSize: number }) {
  return get<{ list: MyCouponItem[]; total: number }>('/weapp/coupon/my', params)
}

export function receiveCoupon(couponId: string) {
  return post(`/weapp/coupon/receive/${encodeURIComponent(couponId)}`)
}

export function getAvailableCoupons(params: { amount: number; productIds: string[] }) {
  return get<MyCouponItem[]>('/weapp/coupon/usable', {
    amount: params.amount,
    // Explicit CSV avoids platform-specific array query serialization differences.
    productIds: params.productIds.join(',')
  })
}

export interface CouponItem {
  id: string
  name: string
  type: number
  value: number
  minAmount: number
  startTime: string
  endTime: string
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
