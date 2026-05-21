import { get } from '@/utils/request'

export function getHomeData() {
  return get<{
    banners: BannerItem[]
    quickEntries: QuickEntry[]
    monthRecommend: ProductItem[]
    hotProducts: ProductItem[]
    newProducts: ProductItem[]
    activities: ActivityItem[]
    guessProducts: ProductItem[]
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
}

export interface ProductItem {
  id: number
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
  startTime: number
  endTime: number
}
