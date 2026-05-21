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

export const ORDER_STATUS_MAP: Record<number, string> = {
  0: '待付款',
  1: '待发货',
  2: '已发货',
  3: '已完成',
  4: '已取消',
  5: '已关闭',
}

export const ORDER_STATUS_TAG_TYPE: Record<number, string> = {
  0: 'warning',
  1: 'primary',
  2: '',
  3: 'success',
  4: 'info',
  5: 'danger',
}

export function formatOrderStatus(status: number): string {
  return ORDER_STATUS_MAP[status] || '未知'
}

export function getOrderStatusTagType(status: number): string {
  return ORDER_STATUS_TAG_TYPE[status] || 'info'
}

export const AFTERSALE_STATUS_MAP: Record<number, string> = {
  0: '待审核',
  1: '审核通过',
  2: '已拒绝',
  3: '退款中',
  4: '已退款',
  5: '已取消',
}

export function formatAftersaleStatus(status: number): string {
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
