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
  id: number
  image: string
  linkType: number
  linkValue: string
}

export interface QuickEntry {
  id: number
  name: string
  icon: string
  linkType: number
  linkValue: string
  linkUrl?: string
}

export interface ProductItem {
  id: string | number
  name: string
  image: string
  price: number
  originalPrice: number
  sales: number
  tag?: string
}

export interface ActivityItem {
  id: number
  name: string
  image: string
  type: number
  startTime: number | string | Date
  endTime: number | string | Date
}
