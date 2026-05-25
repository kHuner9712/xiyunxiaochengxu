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
  id: number
  name: string
  image: string
  description: string
  type: number
  startTime: number
  endTime: number
  rules: string
  discount?: number
  minAmount?: number
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
  productId: number
  name: string
  image: string
  price: number
  originalPrice: number
  activityPrice: number
  stock: number
}
