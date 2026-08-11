import { get, post } from '@/utils/request'
import { runIdempotentCheckout } from '@/utils/checkout-idempotency'

export interface FlashSaleActivity {
  id: string
  name: string
  productId: string
  skuId: string
  flashPrice: number
  originalPrice?: number
  stockLimit: number
  soldCount: number
  lockedCount: number
  limitPerUser: number
  lockMinutes: number
  startTime: string
  endTime: string
  status: number
  sortOrder: number
  description?: string
  coverImage?: string
  now?: string
}

export interface FlashSaleBuyResult {
  flashSaleOrderId: string
  orderId: string
  flashPrice: number
  quantity: number
  lockExpireAt: string
  isZeroPay: boolean
  orderStatus?: string | null
  fulfillmentType?: string | null
}

export interface FlashSaleOrder {
  id: string
  activityId: string
  orderId: string
  quantity: number
  flashPrice: number
  status: string
  lockExpireAt: string
  paidAt?: string | null
  cancelledAt?: string | null
  expiredAt?: string | null
  createdAt: string
}

type FlashSaleBuyInput = {
  activityId: string
  quantity?: number
  addressId?: string
  pickupStoreId?: string
  fulfillmentType?: string
  couponId?: string
  pointsDeduct?: number
  sourceType?: string
  sourceCode?: string
  referrerUserId?: string
  remark?: string
}

export const flashSaleApi = {
  getList(params: { page?: number; pageSize?: number }) {
    return get<{ list: FlashSaleActivity[]; total: number }>('/weapp/flash-sale/list', params)
  },
  getDetail(id: string) {
    return get<FlashSaleActivity>(`/weapp/flash-sale/detail/${id}`)
  },
  async buy(data: FlashSaleBuyInput) {
    const result = await runIdempotentCheckout<FlashSaleBuyResult>(
      `flash-sale:${data.activityId}`,
      data,
      (clientRequestId) => post<FlashSaleBuyResult>('/weapp/flash-sale/buy', {
        ...data,
        clientRequestId,
      }),
    )
    if (result.orderStatus === 'cancelled') {
      throw new Error('上次提交对应秒杀订单已取消，请重新下单')
    }
    return result
  },
  getMyOrders(params: { page?: number; pageSize?: number }) {
    return get<{ list: FlashSaleOrder[]; total: number }>('/weapp/flash-sale/my-orders', params)
  },
}
