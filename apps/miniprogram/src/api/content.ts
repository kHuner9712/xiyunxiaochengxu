import { get } from '@/utils/request'

export function getContentList(params: { categoryId?: number; page: number; pageSize: number }) {
  return get<{ list: ContentItem[]; total: number }>('/content/list', params)
}

export function getContentDetail(id: number) {
  return get<ContentDetail>(`/content/detail/${id}`)
}

export function getContentCategories() {
  return get<ContentCategory[]>('/content/categories')
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
