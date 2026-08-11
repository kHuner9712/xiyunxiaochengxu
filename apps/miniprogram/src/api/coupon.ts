import { get, post } from '@/utils/request'
import { runPersistentIdempotentAction } from '@/utils/checkout-idempotency'

export interface CouponItem {
  id: string
  name: string
  type: number
  value: number
  minAmount: number
  discountLimit?: number
  maxDiscount?: number
  totalCount: number
  receivedCount: number
  remainCount: number
  perLimit: number
  startTime: string
  endTime: string
  validDays: number
  applicableType: number
  applicableIds?: string[]
  memberLevelId?: string | null
  isNewUser: number
  status: number
  received: boolean
  description?: string
}

export interface UserCouponItem {
  id: string
  userId: string
  couponId: string
  status: number
  rawStatus?: number
  expireAt?: string
  usedAt?: string
  useTime?: string
  usedOrderId?: string | null
  name: string
  type: number
  value: number
  minAmount: number
  discountLimit?: number
  startTime: string
  endTime: string
  applicableType: number
  applicableIds?: string[]
  description?: string
  coupon: CouponItem
}

export function getCouponCenter(params: { page: number; pageSize: number }) {
  return get<{ list: CouponItem[]; total: number }>('/weapp/coupon/center', params)
}

export function getClaimableCoupons() {
  return get<CouponItem[]>('/weapp/coupon/available')
}

export function getMyCoupons(params: { status?: number; page: number; pageSize: number }) {
  return get<{ list: UserCouponItem[]; total: number }>('/weapp/coupon/my', params)
}

export function receiveCoupon(couponId: string) {
  return runPersistentIdempotentAction<UserCouponItem>(
    `coupon:receive:${couponId}`,
    { couponId },
    (clientRequestId) => post<UserCouponItem>(
      `/weapp/coupon/receive/${encodeURIComponent(couponId)}`,
      { clientRequestId },
    ),
  )
}

export function getUsableCoupons(params: { amount: number; productIds?: string[] }) {
  return get<UserCouponItem[]>('/weapp/coupon/usable', params)
}
