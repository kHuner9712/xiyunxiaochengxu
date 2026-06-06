import { get } from '@/utils/request'

export function getActivityList(params: { type?: number; page: number; pageSize: number }) {
  return get<{ list: ActivityDetail[]; total: number }>('/weapp/activity/active', params)
}

export function getActivityDetail(id: number) {
  return get<ActivityDetail>(`/weapp/activity/${id}`)
}

export function getActivityFeed(params: { tab: string; page: number; pageSize: number }) {
  return get<{ list: FeedItem[]; total: number }>('/weapp/activity/feed', params)
}

export interface ActivityDetail {
  id: string | number
  name: string
  image?: string
  bannerImage?: string
  description: string
  type: string | number
  startTime: number | string | Date
  endTime: number | string | Date
  rules: string
  discount?: number
  minAmount?: number
  products?: ActivityProduct[]
  activityProducts?: any[]
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
  id?: string | number
  productId: string | number
  skuId?: string | number
  name: string
  image: string
  price: number
  originalPrice: number
  sales: number
  activityPrice: number
  stock: number
}
