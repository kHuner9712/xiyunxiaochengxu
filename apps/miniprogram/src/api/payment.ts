import { post, get } from '@/utils/request'

export function createPayment(orderId: string) {
  return post<PaymentResult>('/weapp/pay/create', { orderId })
}

export function getPaymentStatus(orderId: string) {
  return get<PaymentStatus>(`/weapp/pay/status/${orderId}`)
}

export interface PaymentResult {
  timeStamp: string
  nonceStr: string
  package: string
  signType: string
  paySign: string
}

export interface PaymentStatus {
  orderId: string
  orderNo: string
  orderStatus: string
  paymentStatus: number
  paymentMethod: string
  amount: number
  paidAt: string | null
  transactionId: string | null
}

export function wxPay(params: PaymentResult): Promise<void> {
  return new Promise((resolve, reject) => {
    uni.requestPayment({
      provider: 'wxpay',
      timeStamp: params.timeStamp,
      nonceStr: params.nonceStr,
      package: params.package,
      signType: params.signType as 'MD5' | 'HMAC-SHA256' | 'RSA',
      paySign: params.paySign,
      success: () => resolve(),
      fail: (err) => reject(err)
    })
  })
}
