import { get, post } from '@/utils/request'

export interface FlashSaleActivity {
  id: string
  name: string
  productId: string
  skuId?: string
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
}

export interface FlashSaleOrder {
  id: string
  activityId: string
  userId: string
  orderId: string
  orderItemId?: string
  quantity: number
  flashPrice: number
  status: string
  lockExpireAt: string
  paidAt?: string
  cancelledAt?: string
  expiredAt?: string
  createdAt: string
}

export const flashSaleApi = {
  getList(params: { page?: number; pageSize?: number }) {
    return get<{ list: FlashSaleActivity[]; total: number }>('/weapp/flash-sale/list', params)
  },
  getDetail(id: string | number) {
    return get<FlashSaleActivity>(`/weapp/flash-sale/detail/${id}`)
  },
  buy(data: {
    activityId: number
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
  }) {
    return post<FlashSaleBuyResult>('/weapp/flash-sale/buy', data)
  },
  getMyOrders(params: { page?: number; pageSize?: number }) {
    return get<{ list: FlashSaleOrder[]; total: number }>('/weapp/flash-sale/my-orders', params)
  },
}
