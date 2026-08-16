import { get, post } from '@/utils/request'
import { runIdempotentCheckout } from '@/utils/checkout-idempotency'

export function getActivityList(params: { type?: string; page: number; pageSize: number }) {
  return get<ActivityDetail[]>('/weapp/activity/active', params)
}

export function getActivityDetail(id: string) {
  return get<ActivityDetail>(`/weapp/activity/${encodeURIComponent(id)}`)
}

export function getActivityFeed(params: { tab: string; page: number; pageSize: number }) {
  return get<{ list: FeedItem[]; total: number }>('/weapp/activity/feed', params)
}

export interface ActivityCheckoutInput {
  activityProductId: string
  skuId: string
  quantity: number
  addressId?: string
  pickupStoreId?: string
  fulfillmentType?: 'delivery' | 'pickup'
  sourceType?: string
  sourceCode?: string
  referrerUserId?: string
  remark?: string
}

export interface ActivityOrderPreview {
  activityId: string
  activityProductId: string
  activityType: string
  promotionLabel: string
  items: Array<{
    activityProductId?: string
    productId: string
    skuId: string
    productName: string
    productImage: string
    skuSpecText?: string
    price: number
    originalPrice: number
    quantity: number
    subtotal: number
    isGift?: boolean
  }>
  totalAmount: number
  discountAmount: number
  couponAmount: number
  activityDiscountAmount: number
  pointsAmount: number
  pointsDeducted: number
  availablePoints: number
  maxPointsDeduct: number
  pointsDeductRate: number
  pointsDeductMaxPercent: number
  freightAmount: number
  payAmount: number
  fulfillmentType: 'delivery' | 'pickup'
  isZeroPay: boolean
  promotionStackingDisabled: true
  maxQuantity?: number
}

function buildActivityPreviewFingerprint(activityId: string, data: ActivityCheckoutInput) {
  return JSON.stringify({
    activityId: String(activityId),
    activityProductId: String(data.activityProductId),
    skuId: String(data.skuId),
    quantity: Number(data.quantity),
    addressId: data.addressId || '',
    pickupStoreId: data.pickupStoreId || '',
    fulfillmentType: data.fulfillmentType || '',
  })
}

let activityPreviewVersion = 0
let latestActivityPreviewRequest: {
  version: number
  activityId: string
  fingerprint: string
  promise: Promise<ActivityOrderPreview>
} | null = null
let latestSuccessfulActivityPreviewVersion = 0
let latestSuccessfulActivityPreviewFingerprint = ''

/**
 * Activity checkout can start overlapping previews when quantity or fulfillment selection changes.
 * All overlapping callers converge on the newest preview so an older response cannot restore a
 * stale amount or stock limit after a newer user choice.
 */
export async function previewActivityOrder(activityId: string, data: ActivityCheckoutInput): Promise<ActivityOrderPreview> {
  const normalizedActivityId = String(activityId)
  const version = ++activityPreviewVersion
  const fingerprint = buildActivityPreviewFingerprint(normalizedActivityId, data)
  const requestPromise = post<ActivityOrderPreview>(`/weapp/activity/${encodeURIComponent(normalizedActivityId)}/preview`, data)
  latestActivityPreviewRequest = {
    version,
    activityId: normalizedActivityId,
    fingerprint,
    promise: requestPromise,
  }

  let awaitedVersion = version
  let awaitedActivityId = normalizedActivityId
  let awaitedFingerprint = fingerprint
  let awaitedPromise = requestPromise

  for (;;) {
    try {
      const result = await awaitedPromise
      if (awaitedVersion === activityPreviewVersion) {
        latestSuccessfulActivityPreviewVersion = awaitedVersion
        latestSuccessfulActivityPreviewFingerprint = awaitedFingerprint
        return result
      }
    } catch (error) {
      if (awaitedVersion === activityPreviewVersion) throw error
    }

    const latest = latestActivityPreviewRequest
    if (!latest || latest.activityId !== awaitedActivityId) {
      throw new Error('活动金额试算状态异常，请重试')
    }
    awaitedVersion = latest.version
    awaitedActivityId = latest.activityId
    awaitedFingerprint = latest.fingerprint
    awaitedPromise = latest.promise
  }
}

export async function createActivityOrder(activityId: string, data: ActivityCheckoutInput) {
  const normalizedActivityId = String(activityId)
  const fingerprint = buildActivityPreviewFingerprint(normalizedActivityId, data)
  const latestPreview = latestActivityPreviewRequest

  // When this activity has an active preview contract, the create request must correspond to the
  // newest successfully settled quote. This blocks the submit-vs-quantity/address race between the
  // final pre-preview and the write request. Direct API callers without a preview remain supported.
  if (
    latestPreview?.activityId === normalizedActivityId &&
    (
      latestPreview.fingerprint !== fingerprint ||
      latestSuccessfulActivityPreviewVersion !== latestPreview.version ||
      latestSuccessfulActivityPreviewFingerprint !== fingerprint
    )
  ) {
    throw new Error('活动金额正在重新计算，请稍后再提交')
  }

  const result = await runIdempotentCheckout<{
    orderId: string
    orderNo: string
    payAmount: number
    isZeroPay: boolean
    status: string
    fulfillmentType: string
    activityId: string
    activityProductId: string
  }>(
    `activity:${activityId}:${data.activityProductId}:${data.skuId}`,
    data,
    (clientRequestId) => post(`/weapp/activity/${encodeURIComponent(activityId)}/order`, {
      ...data,
      clientRequestId,
    }),
  )
  if (result.status === 'cancelled') {
    throw new Error('上次提交对应活动订单已取消，请重新提交')
  }
  return result
}

export interface ActivityDetail {
  id: string
  name: string
  image?: string
  bannerImage?: string
  description: string
  type: string
  startTime: number | string | Date
  endTime: number | string | Date
  rules?: Record<string, unknown> | null
  discount?: number
  minAmount?: number
  products?: ActivityProduct[]
  activityProducts?: ActivityProduct[]
  productList?: ActivityProduct[]
  goodsList?: ActivityProduct[]
  now?: string
}

export interface FeedItem {
  type: 'activity' | 'article' | 'video'
  id: string
  title: string
  image: string
  summary?: string
  contentType?: string
  videoUrl?: string
  videoCover?: string
  videoDuration?: number
  tags?: string[]
  viewCount?: number
  publishTime?: string
  isFeatured?: number
  startTime?: string
  endTime?: string
  activityType?: string
}

export interface ActivityProduct {
  id?: string
  activityProductId?: string
  productId: string
  skuId?: string | null
  name: string
  image: string
  price: number
  originalPrice: number
  sales: number
  activityPrice: number
  stock: number
  activityStock?: number
  limitPerUser?: number
  fulfillmentType?: 'delivery' | 'pickup'
  detailUrl?: string
}
