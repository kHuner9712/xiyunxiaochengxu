import { get } from '@/utils/request'

export function getActivityList(params: { type?: number; page: number; pageSize: number }) {
  return get<{ list: ActivityDetail[]; total: number }>('/weapp/activity/active', params)
}

export function getActivityDetail(id: number) {
  return get<ActivityDetail>(`/weapp/activity/${id}`)
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

export interface ActivityProduct {
  productId: number
  name: string
  image: string
  price: number
  originalPrice: number
  activityPrice: number
  stock: number
}
