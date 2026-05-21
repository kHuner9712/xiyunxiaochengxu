import { get } from '@/utils/request'

export function getProductList(params: {
  categoryId?: number
  keyword?: string
  sort?: string
  page: number
  pageSize: number
}) {
  return get<{ list: ProductDetail[]; total: number }>('/product/list', params)
}

export function getProductDetail(id: number) {
  return get<ProductDetail>(`/product/detail/${id}`)
}

export function getProductRecommend(params: { productId: number; page: number; pageSize: number }) {
  return get<{ list: ProductDetail[]; total: number }>('/product/recommend', params)
}

export interface ProductDetail {
  id: number
  name: string
  subtitle: string
  images: string[]
  price: number
  originalPrice: number
  sales: number
  stock: number
  description: string
  skus: SkuItem[]
  specs: SpecGroup[]
  tags: string[]
}

export interface SkuItem {
  id: number
  specs: string
  price: number
  originalPrice: number
  stock: number
  image: string
}

export interface SpecGroup {
  name: string
  values: string[]
}
