import { get } from '@/utils/request'

export type ActivityContentType = 'article' | 'video' | 'product'

export interface ActivityContentListItem {
  id: string
  title: string
  subtitle?: string | null
  type: ActivityContentType
  coverImage?: string | null
  summary?: string | null
  videoUrl?: string | null
  linkedProductId?: string | null
  sortOrder: number
  viewCount: number
  startsAt?: string | null
  endsAt?: string | null
  createdAt: string
}

export interface ActivityContentDetail extends ActivityContentListItem {
  content?: string | null
}

export interface ActivityContentListParams {
  page: number
  pageSize: number
  keyword?: string
  type?: string
}

export function getActivityContentList(params: ActivityContentListParams) {
  return get<{ list: ActivityContentListItem[]; total: number }>('/weapp/activity-content/list', params)
}

export function getActivityContentDetail(id: string | number) {
  return get<ActivityContentDetail>(`/weapp/activity-content/detail/${id}`)
}
