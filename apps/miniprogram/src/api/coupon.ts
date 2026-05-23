import { get, post } from '@/utils/request'

export function getCouponCenter(params: { page: number; pageSize: number }) {
  return get<{ list: CouponItem[]; total: number }>('/weapp/coupon/center', params)
}

export function getMyCoupons(params: { status?: number; page: number; pageSize: number }) {
  return get<{ list: MyCouponItem[]; total: number }>('/weapp/coupon/my', params)
}

export function receiveCoupon(couponId: string | number) {
  return post(`/weapp/coupon/receive/${couponId}`)
}

export function getAvailableCoupons(params: { amount: number; productIds: (string | number)[] }) {
  return get<MyCouponItem[]>('/weapp/coupon/usable', params)
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
  status: number
  useTime?: string
  orderNo?: string
}
