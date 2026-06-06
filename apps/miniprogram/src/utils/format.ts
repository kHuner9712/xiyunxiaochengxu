export function formatPrice(priceInFen: number | string): string {
  const price = typeof priceInFen === 'string' ? parseInt(priceInFen, 10) : priceInFen
  if (isNaN(price)) return '0.00'
  return (price / 100).toFixed(2)
}

export function formatPriceYuan(priceInFen: number | string): number {
  const price = typeof priceInFen === 'string' ? parseInt(priceInFen, 10) : priceInFen
  if (isNaN(price)) return 0
  return price / 100
}

export function formatDate(timestamp: number | string, format = 'YYYY-MM-DD HH:mm:ss'): string {
  const date = new Date(typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp)
  if (isNaN(date.getTime())) return ''

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')

  return format
    .replace('YYYY', String(year))
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds)
}

export function formatOrderStatus(status: string): string {
  const statusMap: Record<string, string> = {
    pending_payment: '待付款',
    paid: '已付款',
    pending_delivery: '待发货',
    pending_pickup: '待自提',
    delivered: '待收货',
    completed: '已完成',
    cancelled: '已取消',
    aftersale: '售后中'
  }
  return statusMap[status] || '未知状态'
}

export type AftersaleStatusValue = string | number | null | undefined

export function normalizeAftersaleStatus(status: AftersaleStatusValue): string {
  const legacyMap: Record<string, string> = {
    '10': 'pending_review',
    '20': 'approved',
    '30': 'refunded',
    '40': 'rejected',
    '50': 'closed'
  }
  const value = String(status ?? '')
  return legacyMap[value] || value
}

export function formatAftersaleStatus(status: AftersaleStatusValue): string {
  const statusMap: Record<string, string> = {
    pending_review: '待审核',
    approved: '已通过/待处理',
    returned: '待退款',
    pending_refund: '待退款',
    refunded: '已完成',
    rejected: '已拒绝',
    closed: '已取消'
  }
  return statusMap[normalizeAftersaleStatus(status)] || '未知状态'
}

export function formatCouponType(type: number): string {
  const typeMap: Record<number, string> = {
    1: '满减券',
    2: '折扣券',
    3: '无门槛券'
  }
  return typeMap[type] || '优惠券'
}

export function formatCouponValue(coupon: { type: number; value: number }): string {
  if (coupon.type === 1 || coupon.type === 3) {
    return `¥${formatPrice(coupon.value)}`
  }
  if (coupon.type === 2) {
    return `${(coupon.value / 10).toFixed(1)}折`
  }
  return ''
}

export function formatBabyAge(birthday: string): string {
  const birth = new Date(birthday)
  const now = new Date()
  const diffMs = now.getTime() - birth.getTime()
  if (diffMs < 0) return '未出生'

  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const years = Math.floor(diffDays / 365)
  const months = Math.floor((diffDays % 365) / 30)

  if (years > 0) {
    return `${years}岁${months > 0 ? months + '个月' : ''}`
  }
  if (months > 0) {
    return `${months}个月`
  }
  return `${diffDays}天`
}

export function formatMonthAge(birthday: string): number {
  const birth = new Date(birthday)
  const now = new Date()
  const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth())
  return Math.max(0, months)
}

export function formatCountdown(endTime: number): string {
  const now = Date.now()
  const diff = endTime - now
  if (diff <= 0) return '已结束'

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)

  if (days > 0) return `${days}天${hours}时${minutes}分`
  if (hours > 0) return `${hours}时${minutes}分${seconds}秒`
  return `${minutes}分${seconds}秒`
}

export function formatPhone(phone: string): string {
  if (!phone || phone.length !== 11) return phone
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
}

export function priceToCent(yuan: number): number {
  return Math.round(yuan * 100)
}
