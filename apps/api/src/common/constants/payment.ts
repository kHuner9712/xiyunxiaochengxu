// 退款状态枚举 (字符串常量)
export const REFUND_STATUS = {
  INITIATING: 'initiating',
  PENDING: 'pending',
  PROCESSING: 'processing',
  SUCCESS: 'success',
  FAILED: 'failed',
  CLOSED: 'closed',
  ABNORMAL: 'abnormal',
} as const;

export type RefundStatus = typeof REFUND_STATUS[keyof typeof REFUND_STATUS];

// 支付状态枚举
export const PAYMENT_STATUS = {
  CREATED: 1,
  SUCCESS: 2,
  FAILED: 3,
} as const;

export type PaymentStatus = typeof PAYMENT_STATUS[keyof typeof PAYMENT_STATUS];

// 微信支付回调状态
export const WECHAT_REFUND_STATUS = {
  SUCCESS: 'SUCCESS',
  CLOSED: 'CLOSED',
  ABNORMAL: 'ABNORMAL',
} as const;

export type WechatRefundStatus = typeof WECHAT_REFUND_STATUS[keyof typeof WECHAT_REFUND_STATUS];

export const COUPON_STATUS = {
  FREE: 1,
  LOCKED: 2,
  USED: 3,
  EXPIRED: 4,
} as const;

export type CouponStatus = typeof COUPON_STATUS[keyof typeof COUPON_STATUS];
