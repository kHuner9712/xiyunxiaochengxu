import { get } from '@/utils/request'

export interface CustomerServiceConfig {
  enabled: boolean
  type: string
  phone: string
  wechatQrCode: string
  serviceTime: string
  autoReplyText: string
  faqContent: string
  notice: string
}

export function getCustomerServiceConfig() {
  return get<CustomerServiceConfig>('/weapp/customer-service/config')
}
