import { post } from '@/utils/request'

export function createPayment(data: { orderId: number; payMethod: string }) {
  return post<PaymentResult>('/payment/create', data)
}

export function getPaymentStatus(orderId: number) {
  return post<PaymentStatus>(`/payment/status/${orderId}`)
}

export interface PaymentResult {
  orderId: number
  orderNo: string
  payParams: WxPayParams
}

export interface WxPayParams {
  timeStamp: string
  nonceStr: string
  package: string
  signType: string
  paySign: string
}

export interface PaymentStatus {
  status: number
  payTime?: string
}

export function wxPay(params: WxPayParams): Promise<void> {
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
