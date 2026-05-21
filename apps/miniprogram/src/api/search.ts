import { get, del } from '@/utils/request'

export function searchProducts(params: {
  keyword: string
  sort?: string
  page: number
  pageSize: number
}) {
  return get<{ list: any[]; total: number }>('/weapp/search', params)
}

export function getHotKeywords() {
  return get<string[]>('/weapp/search/hot')
}

export function getSearchHistory() {
  return get<string[]>('/weapp/search/history')
}

export function clearSearchHistory() {
  return del('/weapp/search/history')
}
