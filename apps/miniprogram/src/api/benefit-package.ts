import { get } from '@/utils/request'

export interface BenefitPackageItem {
  id: string
  name: string
  itemType: string
  description: string | null
  quantity: number
  originalValue: number | null
  verifyRequired: number
  status: number
  merchantPromotionSourceId: string | null
  pickupStoreId: string | null
}

export interface BenefitPackageSummary {
  id: string
  name: string
  subtitle: string | null
  coverImage: string | null
  price: number | null
  validDays: number | null
  validStartAt: string | null
  validEndAt: string | null
  status: number
  sortOrder: number
}

export interface BenefitPackageDetail extends BenefitPackageSummary {
  productId: string | null
  description: string | null
  items: BenefitPackageItem[]
}

export interface UserBenefitPackageSummary {
  id: string
  packageId: string
  packageName: string
  packageCoverImage: string | null
  status: string
  validFrom: string
  validTo: string | null
  orderId: string
}

export interface UserBenefitEntitlementSummary {
  id: string
  userBenefitPackageId: string
  packageItemId: string
  packageName: string
  itemName: string
  itemType: string
  verifyCode: string
  status: string
  usedAt: string | null
  verifyRemark: string | null
  validFrom: string
  validTo: string | null
  pickupStoreId: string | null
  merchantPromotionSourceId: string | null
}

export interface UserBenefitEntitlementDetail extends UserBenefitEntitlementSummary {
  packageSubtitle: string | null
  itemDescription: string | null
  originalValue: number | null
}

export function getBenefitPackageList(params: { page: number; pageSize: number }) {
  return get<{ list: BenefitPackageSummary[]; total: number }>('/weapp/benefit-package/list', params)
}

export function getBenefitPackageDetail(id: string | number) {
  return get<BenefitPackageDetail>(`/weapp/benefit-package/detail/${id}`)
}

export function getMyBenefitPackages(params: { page: number; pageSize: number; status?: string }) {
  return get<{ list: UserBenefitPackageSummary[]; total: number }>('/weapp/benefit-package/my-packages', params)
}

export function getMyBenefitEntitlements(params: {
  page: number
  pageSize: number
  status?: string
  packageId?: string
}) {
  return get<{ list: UserBenefitEntitlementSummary[]; total: number }>(
    '/weapp/benefit-package/my-entitlements',
    params
  )
}

export function getBenefitEntitlement(id: string | number) {
  return get<UserBenefitEntitlementDetail>(`/weapp/benefit-package/entitlement/${id}`)
}
