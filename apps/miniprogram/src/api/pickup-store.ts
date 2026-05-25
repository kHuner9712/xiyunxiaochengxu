import { get } from '@/utils/request'

export function getPickupStoreList(params: { page: number; pageSize: number }) {
  return get<{ list: PickupStoreItem[]; total: number }>('/weapp/pickup-store/list', params)
}

export function getPickupStoreDetail(id: string | number) {
  return get<PickupStoreItem>(`/weapp/pickup-store/${id}`)
}

export interface PickupStoreItem {
  id: string
  name: string
  contactPhone: string
  province: string
  city: string
  district: string
  address: string
  fullAddress: string
  latitude: number | null
  longitude: number | null
  businessHours: string
  pickupNotice: string
  status: number
}
