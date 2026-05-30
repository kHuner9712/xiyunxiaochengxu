import { get, post, put } from '@/utils/request'

export type OrderStatus =
  | 'pending_payment'
  | 'pending_delivery'
  | 'pending_pickup'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'aftersale'

export const ORDER_STATUS_VALUES: OrderStatus[] = [
  'pending_payment',
  'pending_delivery',
  'pending_pickup',
  'delivered',
  'completed',
  'cancelled',
  'aftersale',
]

const LEGACY_ORDER_STATUS_MAP: Record<string, OrderStatus> = {
  '10': 'pending_payment',
  '20': 'pending_delivery',
  '25': 'pending_pickup',
  '30': 'delivered',
  '40': 'completed',
  '50': 'cancelled',
  '60': 'aftersale',
}

export function normalizeOrderStatus(status?: string | number | null): OrderStatus | undefined {
  if (status === undefined || status === null || status === '') return undefined
  const value = String(status)
  if ((ORDER_STATUS_VALUES as string[]).includes(value)) return value as OrderStatus
  return LEGACY_ORDER_STATUS_MAP[value]
}

export function createOrder(data: {
  addressId?: string
  pickupStoreId?: string
  fulfillmentType?: string
  items: OrderItemInput[]
  couponId?: string
  pointsDeduct?: number
  remark?: string
}) {
  return post<{ orderId: string; orderNo: string }>('/weapp/order/create', data)
}

export function getOrderList(params: {
  status?: OrderStatus
  page: number
  pageSize: number
}) {
  return get<{ list: OrderItem[]; total: number }>('/weapp/order/list', params)
}

export function getOrderDetail(id: string | number) {
  return get<OrderDetail>(`/weapp/order/detail/${id}`)
}

export function cancelOrder(id: string | number) {
  return put(`/weapp/order/cancel/${id}`)
}

export function confirmReceive(id: string | number) {
  return put(`/weapp/order/confirm-receive/${id}`)
}

export function getOrderCount() {
  return get<OrderCount>('/weapp/order/count')
}

export interface OrderCount {
  unpaid: number
  unshipped: number
  pendingPickup: number
  unreceived: number
  aftersale: number
}

export interface OrderItemInput {
  productId?: string
  skuId: string
  quantity: number
}

export interface OrderItem {
  id: string
  orderNo: string
  status: OrderStatus
  totalAmount: number
  payAmount: number
  items: OrderProductItem[]
  createTime: string
}

export interface OrderProductItem {
  id: string
  productId: string
  skuId: string
  productName: string
  productImage: string
  skuName: string
  price: number
  quantity: number
  canApplyAftersale?: boolean
  aftersaleStatus?: number | string
  aftersaleDisabledReason?: string
}

export interface OrderDetail {
  id: string
  orderNo: string
  status: OrderStatus
  totalAmount: number
  payAmount: number
  freightAmount: number
  couponAmount: number
  pointsAmount: number
  addressName: string
  addressPhone: string
  addressDetail: string
  fulfillmentType?: string
  pickupStoreId?: string
  pickupStoreName?: string
  pickupStoreAddress?: string
  pickupContactPhone?: string
  pickupCode?: string
  pickedUpAt?: string
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
  items: { skuId: string; quantity: number }[]
  addressId?: string
  pickupStoreId?: string
  fulfillmentType?: string
  couponId?: string
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
  fulfillmentType?: string
  pickupStore?: PickupStoreBrief
}

export interface PickupStoreBrief {
  id: string
  name: string
  address: string
  contactPhone: string
  businessHours: string
  pickupNotice: string
}

export interface OrderPreviewItem {
  productId: string
  skuId: string
  productName: string
  skuSpecs: Record<string, string> | string
  skuSpecText?: string
  productImage: string
  price: number
  originalPrice: number
  quantity: number
  subtotal: number
}
