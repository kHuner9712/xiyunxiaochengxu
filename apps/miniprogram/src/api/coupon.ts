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
  totalCount?: number
  receivedCount?: number
  remainCount: number
  perLimit?: number
  startTime: string
  endTime: string
  validDays?: number
  applicableType?: number
  applicableIds?: string[]
  memberLevelId?: string | null
  isNewUser?: number
  status?: number
  received: boolean
  description?: string
}

export interface UserCouponItem {
  id: string
  userId?: string
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
  applicableType?: number
  applicableIds?: string[]
  description?: string
  coupon?: CouponItem
}

/** Compatibility name used by the order-confirm page and existing callers. */
export type MyCouponItem = UserCouponItem

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

/** Existing order-confirm API: keep the exported name and CSV query contract stable. */
export async function getAvailableCoupons(params: { amount: number; productIds: string[] }) {
  const data = await get<UserCouponItem[]>('/weapp/coupon/usable', {
    amount: params.amount,
    productIds: params.productIds.join(','),
  })
  return Array.isArray(data) ? data : []
}

/** Explicit alias for callers that use the backend route terminology. */
export async function getUsableCoupons(params: { amount: number; productIds?: string[] }) {
  const data = await get<UserCouponItem[]>('/weapp/coupon/usable', {
    amount: params.amount,
    ...(params.productIds?.length ? { productIds: params.productIds.join(',') } : {}),
  })
  return Array.isArray(data) ? data : []
}
