import { get, post, put } from '@/utils/request'

export function createOrder(data: {
  addressId: number
  items: OrderItemInput[]
  couponId?: number
  pointsDeduct?: number
  remark?: string
}) {
  return post<{ orderId: number; orderNo: string }>('/order/create', data)
}

export function getOrderList(params: {
  status?: number
  page: number
  pageSize: number
}) {
  return get<{ list: OrderItem[]; total: number }>('/order/list', params)
}

export function getOrderDetail(id: number) {
  return get<OrderDetail>(`/order/detail/${id}`)
}

export function cancelOrder(id: number) {
  return put(`/order/cancel/${id}`)
}

export function confirmReceive(id: number) {
  return put(`/order/confirm/${id}`)
}

export function deleteOrder(id: number) {
  return put(`/order/delete/${id}`)
}

export function getOrderCount() {
  return get<{ unpaid: number; unshipped: number; unreceived: number; aftersale: number }>('/order/count')
}

export interface OrderItemInput {
  productId: number
  skuId: number
  quantity: number
}

export interface OrderItem {
  id: number
  orderNo: string
  status: number
  totalAmount: number
  payAmount: number
  items: OrderProductItem[]
  createTime: string
}

export interface OrderProductItem {
  productId: number
  skuId: number
  productName: string
  productImage: string
  skuName: string
  price: number
  quantity: number
}

export interface OrderDetail {
  id: number
  orderNo: string
  status: number
  totalAmount: number
  payAmount: number
  freightAmount: number
  couponAmount: number
  pointsAmount: number
  addressId: number
  addressName: string
  addressPhone: string
  addressDetail: string
  items: OrderProductItem[]
  logistics?: LogisticsInfo
  createTime: string
  payTime?: string
  shipTime?: string
  receiveTime?: string
  remark?: string
}

export interface LogisticsInfo {
  company: string
  trackingNo: string
  traces: LogisticsTrace[]
}

export interface LogisticsTrace {
  time: string
  content: string
}
