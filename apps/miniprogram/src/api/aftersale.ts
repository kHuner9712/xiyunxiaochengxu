import { get, post, put } from '@/utils/request'

export function applyAftersale(data: AftersaleForm) {
  return post<{ id: string }>('/weapp/aftersale/create', data)
}

export function getAftersaleList(params: { page: number; pageSize: number }) {
  return get<{ list: AftersaleItem[]; total: number }>('/weapp/aftersale/list', params)
}

export function getAftersaleDetail(id: string | number) {
  return get<AftersaleDetail>(`/weapp/aftersale/detail/${id}`)
}

export function cancelAftersale(id: string | number) {
  return put(`/weapp/aftersale/cancel/${id}`)
}

export interface AftersaleForm {
  orderId: string | number
  orderItemId: string | number
  type: number
  reason: string
  description: string
  images: string[]
}

export interface AftersaleItem {
  id: string
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
  id: string
  orderId: string
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
