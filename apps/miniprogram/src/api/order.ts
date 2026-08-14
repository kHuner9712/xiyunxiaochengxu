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

const PENDING_ORDER_CREATE_KEY = 'baby_mall_pending_order_create'
const PENDING_ORDER_CREATE_TTL_MS = 2 * 60 * 60 * 1000
const CLIENT_REQUEST_ID_PATTERN = /^\d{13}-[a-z0-9]{16,40}$/i

export function normalizeOrderStatus(status?: string | number | null): OrderStatus | undefined {
  if (status === undefined || status === null || status === '') return undefined
  const value = String(status)
  if ((ORDER_STATUS_VALUES as string[]).includes(value)) return value as OrderStatus
  return LEGACY_ORDER_STATUS_MAP[value]
}

export interface CreateOrderRequest {
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
}

function buildOrderCreateFingerprint(data: CreateOrderRequest) {
  const items = data.items
    .map((item) => ({ skuId: String(item.skuId), quantity: Number(item.quantity) }))
    .sort((a, b) => a.skuId.localeCompare(b.skuId) || a.quantity - b.quantity)
  return JSON.stringify({
    addressId: data.addressId || '',
    pickupStoreId: data.pickupStoreId || '',
    fulfillmentType: data.fulfillmentType || '',
    couponId: data.couponId || '',
    pointsDeduct: Number(data.pointsDeduct || 0),
    sourceType: data.sourceType || '',
    sourceCode: data.sourceCode || '',
    shareRecordId: data.shareRecordId || '',
    shareCampaignId: data.shareCampaignId || '',
    referrerUserId: data.referrerUserId || '',
    remark: data.remark || '',
    items,
  })
}

function generateOrderClientRequestId() {
  const random = [
    Math.random().toString(36).slice(2),
    Math.random().toString(36).slice(2),
    Math.random().toString(36).slice(2),
  ].join('').replace(/[^a-z0-9]/gi, '').padEnd(24, '0').slice(0, 24)
  return `${Date.now()}-${random}`
}

function loadPendingOrderClientRequestId(fingerprint: string): string | null {
  try {
    const raw = uni.getStorageSync(PENDING_ORDER_CREATE_KEY)
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw
    const clientRequestId = String(value?.clientRequestId || '')
    const createdAt = Number(value?.createdAt || 0)
    const storedFingerprint = String(value?.fingerprint || '')
    const now = Date.now()
    if (
      CLIENT_REQUEST_ID_PATTERN.test(clientRequestId) &&
      storedFingerprint === fingerprint &&
      Number.isFinite(createdAt) &&
      createdAt > 0 &&
      now - createdAt >= 0 &&
      now - createdAt <= PENDING_ORDER_CREATE_TTL_MS
    ) {
      return clientRequestId
    }
  } catch {
    // Corrupted local state must never block checkout; replace it with a fresh request identity.
  }
  uni.removeStorageSync(PENDING_ORDER_CREATE_KEY)
  return null
}

function getOrCreateOrderClientRequestId(fingerprint: string): string {
  const existing = loadPendingOrderClientRequestId(fingerprint)
  if (existing) return existing
  const clientRequestId = generateOrderClientRequestId()
  uni.setStorageSync(PENDING_ORDER_CREATE_KEY, {
    clientRequestId,
    createdAt: Date.now(),
    fingerprint,
  })
  return clientRequestId
}

function clearPendingOrderClientRequestId(clientRequestId: string) {
  try {
    const raw = uni.getStorageSync(PENDING_ORDER_CREATE_KEY)
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (String(value?.clientRequestId || '') === clientRequestId) {
      uni.removeStorageSync(PENDING_ORDER_CREATE_KEY)
    }
  } catch {
    uni.removeStorageSync(PENDING_ORDER_CREATE_KEY)
  }
}

function buildPreviewInputFromCreate(data: CreateOrderRequest): OrderPreviewRequest {
  return {
    items: data.items.map((item) => ({
      skuId: String(item.skuId),
      quantity: Number(item.quantity),
    })),
    addressId: data.addressId,
    pickupStoreId: data.pickupStoreId,
    fulfillmentType: data.fulfillmentType,
    couponId: data.couponId,
    pointsDeduct: data.pointsDeduct,
  }
}

function buildOrderPreviewFingerprint(data: OrderPreviewRequest) {
  const items = data.items
    .map((item) => ({ skuId: String(item.skuId), quantity: Number(item.quantity) }))
    .sort((a, b) => a.skuId.localeCompare(b.skuId) || a.quantity - b.quantity)
  return JSON.stringify({
    addressId: data.addressId || '',
    pickupStoreId: data.pickupStoreId || '',
    fulfillmentType: data.fulfillmentType || '',
    couponId: data.couponId || '',
    pointsDeduct: Number(data.pointsDeduct || 0),
    items,
  })
}

export async function createOrder(data: CreateOrderRequest) {
  // Never create from a quote that belongs to an older address/coupon/points selection, and never
  // create while the matching quote is still in flight. This closes the tap-submit window where
  // the page can still be displaying a previous successful preview while the newest preview has
  // not settled yet.
  const previewFingerprint = buildOrderPreviewFingerprint(buildPreviewInputFromCreate(data))
  const latestPreview = latestPreviewRequest
  if (
    !latestPreview ||
    latestPreview.fingerprint !== previewFingerprint ||
    latestSuccessfulPreviewVersion !== latestPreview.version ||
    latestSuccessfulPreviewFingerprint !== previewFingerprint
  ) {
    throw new Error('订单金额正在重新计算，请稍后再提交')
  }

  // Keep this identity across network failures and page/process re-entry only while the actual
  // checkout payload is unchanged. If the user changes items/address/coupon/points after a timeout,
  // that is a new purchase intent and must never recover an older committed order by accident.
  const fingerprint = buildOrderCreateFingerprint(data)
  const clientRequestId = getOrCreateOrderClientRequestId(fingerprint)
  const result = await post<{
    orderId: string
    orderNo: string
    payAmount: number
    isZeroPay: boolean
    status: OrderStatus
    fulfillmentType?: string
  }>('/weapp/order/create', {
    ...data,
    clientRequestId,
  })
  clearPendingOrderClientRequestId(clientRequestId)
  if (result.status === 'cancelled') {
    throw new Error('上次提交对应订单已取消，请重新提交')
  }
  return result
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
let latestPreviewRequest: {
  version: number
  fingerprint: string
  promise: Promise<OrderPreview>
} | null = null
let latestSuccessfulPreviewVersion = 0
let latestSuccessfulPreviewFingerprint = ''

/**
 * Order confirmation is highly interactive: changing address, fulfillment, coupon or points can
 * start another quote while the previous request is still in flight. A slower stale response must
 * never overwrite a newer quote in the page. Every caller therefore converges on the newest
 * in-flight request before resolving; stale successes and stale failures are both ignored.
 */
export async function previewOrder(data: OrderPreviewRequest): Promise<OrderPreview> {
  const version = ++previewRequestVersion
  const fingerprint = buildOrderPreviewFingerprint(data)
  const requestPromise = post<OrderPreview>('/weapp/order/confirm', data)
  latestPreviewRequest = { version, fingerprint, promise: requestPromise }

  let awaitedVersion = version
  let awaitedFingerprint = fingerprint
  let awaitedPromise = requestPromise

  for (;;) {
    try {
      const result = await awaitedPromise
      if (awaitedVersion === previewRequestVersion) {
        latestSuccessfulPreviewVersion = awaitedVersion
        latestSuccessfulPreviewFingerprint = awaitedFingerprint
        return result
      }
    } catch (error) {
      if (awaitedVersion === previewRequestVersion) throw error
    }

    const latest = latestPreviewRequest
    if (!latest) {
      throw new Error('订单试算状态异常，请重试')
    }
    awaitedVersion = latest.version
    awaitedFingerprint = latest.fingerprint
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
