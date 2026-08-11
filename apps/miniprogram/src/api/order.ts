import { get, post, put } from '@/utils/request'

export type OrderStatus =
  | 'pending_payment'
  | 'paid'
  | 'pending_delivery'
  | 'pending_pickup'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'aftersale'

export const ORDER_STATUS_VALUES: OrderStatus[] = [
  'pending_payment',
  'paid',
  'pending_delivery',
  'pending_pickup',
  'delivered',
  'completed',
  'cancelled',
  'aftersale',
]

const LEGACY_ORDER_STATUS_MAP: Record<string, OrderStatus> = {
  '10': 'pending_payment',
  '15': 'paid',
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
  sourceType?: string
  sourceCode?: string
  shareRecordId?: string
  shareCampaignId?: string
  referrerUserId?: string
  remark?: string
}) {
  return post<{
    orderId: string
    orderNo: string
    payAmount: number
    isZeroPay: boolean
    status: OrderStatus
    fulfillmentType?: string
  }>('/weapp/order/create', data)
}

export function getOrderList(params: {
  status?: OrderStatus
  page: number
  pageSize: number
}) {
  return get<{ list: OrderItem[]; total: number }>('/weapp/order/list', params)
}

export function getOrderDetail(id: string) {
  return get<OrderDetail>(`/weapp/order/detail/${encodeURIComponent(id)}`)
}

export function getOrderDetailByNo(orderNo: string) {
  return get<OrderDetail>(`/weapp/order/detail-by-no/${encodeURIComponent(orderNo)}`)
}

export function cancelOrder(id: string) {
  return put(`/weapp/order/cancel/${encodeURIComponent(id)}`)
}

export function confirmReceive(id: string) {
  return put(`/weapp/order/confirm-receive/${encodeURIComponent(id)}`)
}

export function getOrderCount() {
  return get<OrderCount>('/weapp/order/count')
}

export interface OrderCount {
  unpaid: number
  paid?: number
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
  groupBuyGroupId?: string
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
  subtotal?: number
  activityDiscount?: number
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
  discountAmount: number
  activityDiscountAmount: number
  couponAmount: number
  pointsAmount: number
  groupBuyGroupId?: string
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

type OrderPreviewRequest = {
  items: { skuId: string; quantity: number }[]
  addressId?: string
  pickupStoreId?: string
  fulfillmentType?: string
  couponId?: string
  pointsDeduct?: number
}

let previewRequestVersion = 0
let latestPreviewRequest: { version: number; promise: Promise<OrderPreview> } | null = null

/**
 * Order confirmation is highly interactive: changing address, fulfillment, coupon or points can
 * start another quote while the previous request is still in flight. A slower stale response must
 * never overwrite a newer quote in the page. Every caller therefore converges on the newest
 * in-flight request before resolving; stale successes and stale failures are both ignored.
 */
export async function previewOrder(data: OrderPreviewRequest): Promise<OrderPreview> {
  const version = ++previewRequestVersion
  const requestPromise = post<OrderPreview>('/weapp/order/confirm', data)
  latestPreviewRequest = { version, promise: requestPromise }

  let awaitedVersion = version
  let awaitedPromise = requestPromise

  for (;;) {
    try {
      const result = await awaitedPromise
      if (awaitedVersion === previewRequestVersion) return result
    } catch (error) {
      if (awaitedVersion === previewRequestVersion) throw error
    }

    const latest = latestPreviewRequest
    if (!latest) {
      throw new Error('订单试算状态异常，请重试')
    }
    awaitedVersion = latest.version
    awaitedPromise = latest.promise
  }
}

export interface OrderPreview {
  items: OrderPreviewItem[]
  totalAmount: number
  discountAmount: number
  couponAmount: number
  activityDiscountAmount: number
  pointsAmount: number
  pointsDeducted: number
  availablePoints: number
  maxPointsDeduct: number
  pointsDeductRate: number
  pointsDeductMaxPercent: number
  freightAmount: number
  payAmount: number
  isZeroPay?: boolean
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
