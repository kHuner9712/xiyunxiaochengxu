import { get, post, put, del } from '@/utils/request'

export function getAddressList() {
  return get<AddressItem[]>('/address/list')
}

export function getAddressDetail(id: number) {
  return get<AddressItem>(`/address/detail/${id}`)
}

export function createAddress(data: AddressForm) {
  return post('/address/create', data)
}

export function updateAddress(data: AddressForm & { id: number }) {
  return put('/address/update', data)
}

export function deleteAddress(id: number) {
  return del(`/address/delete/${id}`)
}

export function setDefaultAddress(id: number) {
  return put(`/address/set-default/${id}`)
}

export function getDefaultAddress() {
  return get<AddressItem>('/address/default')
}

export interface AddressItem {
  id: number
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
