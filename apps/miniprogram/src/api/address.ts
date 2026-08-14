import { get, post, put, del } from '@/utils/request'

export function getAddressList() {
  return get<AddressItem[]>('/weapp/address')
}

export function getAddressDetail(id: string) {
  return get<AddressItem>(`/weapp/address/${encodeURIComponent(id)}`)
}

export function createAddress(data: AddressForm) {
  return post('/weapp/address', data)
}

export function updateAddress(data: AddressForm & { id: string }) {
  const { id, ...payload } = data
  return put(`/weapp/address/${encodeURIComponent(id)}`, payload)
}

export function deleteAddress(id: string) {
  return del(`/weapp/address/${encodeURIComponent(id)}`)
}

export function setDefaultAddress(id: string) {
  return put(`/weapp/address/${encodeURIComponent(id)}/default`)
}

export interface AddressItem {
  id: string
  name: string
  phone: string
  province: string
  city: string
  district: string
  detail: string
  isDefault: boolean
}

export interface AddressForm {
  name: string
  phone: string
  province: string
  city: string
  district: string
  detail: string
  isDefault: boolean
}