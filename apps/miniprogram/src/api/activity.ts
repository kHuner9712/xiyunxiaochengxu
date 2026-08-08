import { get, post } from '@/utils/request'

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
    productId: string
    skuId: string
    productName: string
    productImage: string
    skuSpecText?: string
    price: number
    originalPrice: number
    quantity: number
    subtotal: number
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
}

export function previewActivityOrder(activityId: string, data: ActivityCheckoutInput) {
  return post<ActivityOrderPreview>(`/weapp/activity/${encodeURIComponent(activityId)}/preview`, data)
}

export function createActivityOrder(activityId: string, data: ActivityCheckoutInput) {
  return post<{
    orderId: string
    orderNo: string
    payAmount: number
    isZeroPay: boolean
    status: string
    fulfillmentType: string
    activityId: string
    activityProductId: string
  }>(`/weapp/activity/${encodeURIComponent(activityId)}/order`, data)
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
  detailUrl?: string
}
