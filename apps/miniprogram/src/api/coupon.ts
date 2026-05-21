import { get, post } from '@/utils/request'

export function getCouponCenter(params: { page: number; pageSize: number }) {
  return get<{ list: CouponItem[]; total: number }>('/coupon/center', params)
}

export function getMyCoupons(params: { status?: number; page: number; pageSize: number }) {
  return get<{ list: MyCouponItem[]; total: number }>('/coupon/my', params)
}

export function receiveCoupon(couponId: number) {
  return post('/coupon/receive', { couponId })
}

export function getAvailableCoupons(params: { amount: number; productIds: number[] }) {
  return get<MyCouponItem[]>('/coupon/available', params)
}

export interface CouponItem {
  id: number
  name: string
  type: number
  value: number
  minAmount: number
  startTime: string
  endTime: string
  received: boolean
  remainCount: number
}

export interface MyCouponItem {
  id: number
  couponId: number
  name: string
  type: number
  value: number
  minAmount: number
  startTime: string
  endTime: string
  status: number
  useTime?: string
  orderNo?: string
}
