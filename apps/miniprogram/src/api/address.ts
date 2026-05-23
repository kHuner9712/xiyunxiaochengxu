import { get, post, put, del } from '@/utils/request'

export function getAddressList() {
  return get<AddressItem[]>('/weapp/address')
}

export function getAddressDetail(id: string | number) {
  return get<AddressItem>(`/weapp/address/${id}`)
}

export function createAddress(data: AddressForm) {
  return post('/weapp/address', data)
}

export function updateAddress(data: AddressForm & { id: string | number }) {
  return put(`/weapp/address/${data.id}`, data)
}

export function deleteAddress(id: string | number) {
  return del(`/weapp/address/${id}`)
}

export function setDefaultAddress(id: string | number) {
  return put(`/weapp/address/${id}/default`)
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
