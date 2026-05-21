import { get } from '@/utils/request'

export function getActivityList(params: { type?: number; page: number; pageSize: number }) {
  return get<{ list: ActivityDetail[]; total: number }>('/weapp/activity/list', params)
}

export function getActivityDetail(id: number) {
  return get<ActivityDetail>(`/weapp/activity/detail/${id}`)
}

export function getActivityProducts(params: { activityId: number; page: number; pageSize: number }) {
  return get<{ list: ActivityProduct[]; total: number }>('/activity/products', params)
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
