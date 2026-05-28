import { get } from '@/utils/request'

export function getProductList(params: {
  categoryId?: number
  keyword?: string
  sort?: string
  page: number
  pageSize: number
}) {
  return get<{ list: ProductDetail[]; total: number }>('/weapp/product/list', params)
}

export function getProductDetail(id: number) {
  return get<ProductDetail>(`/weapp/product/detail/${id}`)
}

export function getProductRecommend(params: { productId: number; page: number; pageSize: number }) {
  return get<{ list: ProductDetail[]; total: number }>('/weapp/product/recommend', params)
}

export interface ProductDetail {
  id: number
  status?: number
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
  compliance?: ProductCompliance
}

export interface ProductCompliance {
  isFood: boolean
  isHealthSupplement: boolean
  isInfantFormula: boolean
  productionLicenseNo: string
  foodBusinessCertNo: string
  healthSupplementApprovalNo: string
  infantFormulaRegNo: string
  manufacturer: string
  supplierName: string
  shelfLife: string
  storageCondition: string
  suitableFor: string
  notSuitableFor: string
  precautions: string
  certImages: string[]
}

export interface SkuItem {
  id: number
  specs: Record<string, string> | string
  specText: string
  price: number
  originalPrice: number
  stock: number
  image: string
}

export interface SpecGroup {
  name: string
  values: string[]
}
