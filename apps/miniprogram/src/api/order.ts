import { get, post, put } from '@/utils/request'

export function createOrder(data: {
  addressId: number
  items: OrderItemInput[]
  couponId?: number
  pointsDeduct?: number
  remark?: string
}) {
  return post<{ orderId: number; orderNo: string }>('/weapp/order/create', data)
}

export function getOrderList(params: {
  status?: string
  page: number
  pageSize: number
}) {
  return get<{ list: OrderItem[]; total: number }>('/weapp/order/list', params)
}

export function getOrderDetail(id: number) {
  return get<OrderDetail>(`/weapp/order/detail/${id}`)
}

export function cancelOrder(id: number) {
  return put(`/weapp/order/cancel/${id}`)
}

export function confirmReceive(id: number) {
  return put(`/weapp/order/confirm-receive/${id}`)
}

export function getOrderCount() {
  return get<{ unpaid: number; unshipped: number; unreceived: number; aftersale: number }>('/weapp/order/count')
}

export interface OrderItemInput {
  productId: number
  skuId: number
  quantity: number
}

export interface OrderItem {
  id: number
  orderNo: string
  status: string
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
  status: string
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

export function previewOrder(data: {
  items: { skuId: number; quantity: number }[]
  addressId?: number
  couponId?: number
  pointsDeduct?: number
}) {
  return post<OrderPreview>('/weapp/order/confirm', data)
}

export interface OrderPreview {
  items: OrderPreviewItem[]
  totalAmount: number
  discountAmount: number
  couponAmount: number
  activityDiscountAmount: number
  pointsAmount: number
  freightAmount: number
  payAmount: number
}

export interface OrderPreviewItem {
  productId: string
  skuId: string
  productName: string
  skuSpecs: string
  productImage: string
  price: number
  originalPrice: number
  quantity: number
  subtotal: number
}
