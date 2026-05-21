import { get } from '@/utils/request'

export function getContentList(params: { categoryId?: number; page: number; pageSize: number }) {
  return get<{ list: ContentItem[]; total: number }>('/weapp/content/list', params)
}

export function getContentDetail(id: number) {
  return get<ContentDetail>(`/weapp/content/${id}`)
}

export function getContentCategories() {
  return get<ContentCategory[]>('/weapp/content/categories')
}

export interface ContentItem {
  id: number
  title: string
  cover: string
  summary: string
  categoryId: number
  categoryName: string
  viewCount: number
  createTime: string
}

export interface ContentDetail {
  id: number
  title: string
  cover: string
  content: string
  categoryId: number
  categoryName: string
  viewCount: number
  createTime: string
}

export interface ContentCategory {
  id: number
  name: string
}
