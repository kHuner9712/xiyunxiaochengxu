import { get } from '@/utils/request'

export function getHomeData() {
  return get<{
    banners: BannerItem[]
    quickEntries: QuickEntry[]
    announcement?: string
    monthRecommend: ProductItem[]
    hotProducts: ProductItem[]
    newProducts: ProductItem[]
    activities: ActivityItem[]
  }>('/weapp/home/data')
}

export function getGuessProducts(params: { page: number; pageSize: number }) {
  return get<{ list: ProductItem[]; total: number }>('/weapp/home/guess', params)
}

export interface BannerItem {
  id: string
  image: string
  /** 0 none, 1 product detail, 2 activity detail, 3 mini-program page path. */
  linkType: 0 | 1 | 2 | 3
  linkValue: string
}

export interface QuickEntry {
  id: string
  name: string
  icon: string
  linkType: number
  linkValue: string
  linkUrl?: string
}

export interface ProductItem {
  id: string
  name: string
  image: string
  price: number
  originalPrice: number
  sales: number
  tag?: string
}

export interface ActivityItem {
  id: string
  name: string
  image: string
  type: number
  startTime: number | string | Date
  endTime: number | string | Date
}
