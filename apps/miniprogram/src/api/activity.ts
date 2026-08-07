import { get } from '@/utils/request'

export function getActivityList(params: { type?: string; page: number; pageSize: number }) {
  return get<ActivityDetail[]>('/weapp/activity/active', params)
}

export function getActivityDetail(id: string) {
  return get<ActivityDetail>(`/weapp/activity/${encodeURIComponent(id)}`)
}

export function getActivityFeed(params: { tab: string; page: number; pageSize: number }) {
  return get<{ list: FeedItem[]; total: number }>('/weapp/activity/feed', params)
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
}
