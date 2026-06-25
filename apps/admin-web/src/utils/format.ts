import dayjs from 'dayjs'

export function formatPrice(priceInFen: number | string | null | undefined): string {
  if (priceInFen === null || priceInFen === undefined || priceInFen === '') return '0.00'
  const num = typeof priceInFen === 'string' ? parseFloat(priceInFen) : priceInFen
  if (isNaN(num)) return '0.00'
  return (num / 100).toFixed(2)
}

export function priceToYuan(priceInFen: number): number {
  if (!priceInFen && priceInFen !== 0) return 0
  return priceInFen / 100
}

export function priceToFen(priceInYuan: number | string): number {
  if (!priceInYuan && priceInYuan !== 0) return 0
  const num = typeof priceInYuan === 'string' ? parseFloat(priceInYuan) : priceInYuan
  return Math.round(num * 100)
}

export function formatDate(value: string | number | Date | null | undefined, format = 'YYYY-MM-DD HH:mm:ss'): string {
  if (!value) return '-'
  return dayjs(value).format(format)
}

export function formatDateShort(value: string | number | Date | null | undefined): string {
  return formatDate(value, 'YYYY-MM-DD')
}

export const ORDER_STATUS_MAP: Record<string, string> = {
  pending_payment: '待付款',
  paid: '已付款',
  pending_delivery: '待发货',
  pending_pickup: '待自提',
  delivered: '已发货',
  completed: '已完成',
  cancelled: '已取消',
  aftersale: '售后中',
}

export const ORDER_STATUS_TAG_TYPE: Record<string, string> = {
  pending_payment: 'warning',
  paid: 'primary',
  pending_delivery: 'primary',
  pending_pickup: 'warning',
  delivered: '',
  completed: 'success',
  cancelled: 'info',
  aftersale: 'danger',
}

export function formatOrderStatus(status: string): string {
  return ORDER_STATUS_MAP[status] || '未知'
}

export function getOrderStatusTagType(status: string): string {
  return ORDER_STATUS_TAG_TYPE[status] || 'info'
}

export const ORDER_SOURCE_TYPE_MAP: Record<string, string> = {
  direct: '普通进入',
  user_referral: '用户推荐',
  merchant_referral: '商家推广',
  campaign: '活动推广',
}

export const ORDER_SOURCE_TAG_TYPE: Record<string, string> = {
  direct: 'info',
  user_referral: 'success',
  merchant_referral: 'warning',
  campaign: 'primary',
}

export function formatOrderSourceType(sourceType: string | null | undefined): string {
  return ORDER_SOURCE_TYPE_MAP[sourceType || 'direct'] || '未知来源'
}

export function getOrderSourceTagType(sourceType: string | null | undefined): string {
  return ORDER_SOURCE_TAG_TYPE[sourceType || 'direct'] || 'info'
}

export const AFTERSALE_STATUS_MAP: Record<string, string> = {
  pending_review: '待审核',
  approved: '审核通过',
  rejected: '已拒绝',
  returned: '已退货',
  refunded: '已退款',
  closed: '已关闭',
}

export function formatAftersaleStatus(status: string): string {
  return AFTERSALE_STATUS_MAP[status] || '未知'
}

export const COUPON_TYPE_MAP: Record<number, string> = {
  1: '满减券',
  2: '折扣券',
  3: '无门槛券',
}

export function formatCouponType(type: number): string {
  return COUPON_TYPE_MAP[type] || '未知'
}

export const ACTIVITY_STATUS_MAP: Record<number, string> = {
  0: '未开始',
  1: '进行中',
  2: '已结束',
}

export function formatActivityStatus(status: number): string {
  return ACTIVITY_STATUS_MAP[status] || '未知'
}

export function formatPercent(value: number): string {
  if (value === null || value === undefined) return '0%'
  return (value * 100).toFixed(2) + '%'
}
