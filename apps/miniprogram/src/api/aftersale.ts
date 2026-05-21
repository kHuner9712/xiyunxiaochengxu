import { get, post } from '@/utils/request'

export function applyAftersale(data: AftersaleForm) {
  return post<{ id: number }>('/aftersale/apply', data)
}

export function getAftersaleList(params: { page: number; pageSize: number }) {
  return get<{ list: AftersaleItem[]; total: number }>('/aftersale/list', params)
}

export function getAftersaleDetail(id: number) {
  return get<AftersaleDetail>(`/weapp/aftersale/detail/${id}`)
}

export function cancelAftersale(id: number) {
  return post(`/weapp/aftersale/cancel/${id}`)
}

export function getAftersaleReasons() {
  return get<string[]>('/weapp/aftersale/reasons')
}

export interface AftersaleForm {
  orderId: number
  orderItemId: number
  type: number
  reason: string
  description: string
  images: string[]
}

export interface AftersaleItem {
  id: number
  orderNo: string
  type: number
  reason: string
  status: number
  refundAmount: number
  productName: string
  productImage: string
  createTime: string
}

export interface AftersaleDetail {
  id: number
  orderId: number
  orderNo: string
  type: number
  reason: string
  description: string
  images: string[]
  status: number
  refundAmount: number
  productName: string
  productImage: string
  skuName: string
  price: number
  quantity: number
  logs: AftersaleLog[]
  createTime: string
}

export interface AftersaleLog {
  time: string
  content: string
  status: number
}
