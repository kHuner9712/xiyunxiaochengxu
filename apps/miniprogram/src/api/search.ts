import { get } from '@/utils/request'

export function searchProducts(params: {
  keyword: string
  sort?: string
  page: number
  pageSize: number
}) {
  return get<{ list: any[]; total: number }>('/search', params)
}

export function getHotKeywords() {
  return get<string[]>('/search/hot')
}

export function getSearchHistory() {
  return get<string[]>('/search/history')
}

export function clearSearchHistory() {
  return get('/search/history/clear')
}

export function getSearchSuggest(keyword: string) {
  return get<string[]>('/search/suggest', { keyword })
}
