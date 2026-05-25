import { get } from '@/utils/request'

export function getContentList(params: { categoryId?: number; contentType?: string; placement?: string; keyword?: string; page: number; pageSize: number }) {
  return get<{ list: ContentItem[]; total: number }>('/weapp/content/list', params)
}

export function getContentDetail(id: number) {
  return get<ContentDetail>(`/weapp/content/${id}`)
}

export function getContentCategories() {
  return get<ContentCategory[]>('/weapp/content/categories')
}

export interface ContentItem {
  id: string
  title: string
  coverImage: string
  summary: string
  categoryId: string
  contentType: string
  videoUrl?: string
  videoCover?: string
  videoDuration?: number
  tags?: string[]
  viewCount: number
  publishedAt: string
}

export interface ContentDetail {
  id: string
  title: string
  coverImage: string
  content: string
  categoryId: string
  contentType: string
  summary: string
  videoUrl?: string
  videoCover?: string
  videoDuration?: number
  tags?: string[]
  relatedProductIds?: number[]
  relatedActivityId?: string
  viewCount: number
  publishedAt: string
}

export interface ContentCategory {
  id: number
  name: string
}
