import { get, post } from '@/utils/request'
import { runIdempotentCheckout } from '@/utils/checkout-idempotency'

export interface GroupBuyActivity {
  id: string
  name: string
  productId: string
  skuId: string
  groupPrice: number
  originalPrice?: number
  groupSize: number
  groupExpireHours: number
  stockLimit?: number
  soldCount: number
  limitPerUser: number
  startTime: string
  endTime: string
  status: number
  sortOrder: number
  description?: string
  coverImage?: string
  now?: string
}

export interface PublicGroupBuyMember {
  role: string
  status: string
  paidAt?: string | null
  createdAt?: string
  isCurrentUser?: boolean
  user?: {
    nickname: string
    avatarUrl?: string
  } | null
}

export interface GroupBuyGroup {
  id: string
  activityId: string
  status: string
  groupNo: string
  currentCount: number
  targetCount: number
  expiresAt: string
  successAt?: string
  failedAt?: string
  createdAt: string
  now?: string
  members?: PublicGroupBuyMember[]
  leader?: { nickname: string; avatarUrl?: string } | null
  activity?: { id: string; name: string; coverImage?: string; groupPrice: number; groupSize: number } | null
}

export interface StartGroupBuyResult {
  groupId: string
  groupNo: string
  orderId: string
  role: string
  isZeroPay: boolean
  orderStatus?: string | null
  fulfillmentType?: string | null
}

type StartGroupBuyInput = {
  activityId: string
  skuId?: string
  quantity?: number
  addressId?: string
  pickupStoreId?: string
  fulfillmentType?: string
  remark?: string
}

type JoinGroupBuyInput = {
  groupId: string
  quantity?: number
  addressId?: string
  pickupStoreId?: string
  fulfillmentType?: string
  remark?: string
}

async function assertReusableGroupCheckout(result: StartGroupBuyResult) {
  if (result.orderStatus === 'cancelled') {
    throw new Error('上次提交对应拼团订单已取消，请重新提交')
  }
  return result
}

export const groupBuyApi = {
  getList(params: { page?: number; pageSize?: number }) {
    return get<{ list: GroupBuyActivity[]; total: number }>('/weapp/group-buy/list', params)
  },
  getDetail(id: string) {
    return get<GroupBuyActivity>(`/weapp/group-buy/detail/${id}`)
  },
  getAvailableGroups(activityId: string) {
    return get<GroupBuyGroup[]>('/weapp/group-buy/available-groups', { activityId })
  },
  getMyGroups(params: { page?: number; pageSize?: number }) {
    return get<{ list: GroupBuyGroup[]; total: number }>('/weapp/group-buy/my-groups', params)
  },
  getGroupDetail(id: string) {
    return get<GroupBuyGroup>(`/weapp/group-buy/group/${id}`)
  },
  async start(data: StartGroupBuyInput) {
    const result = await runIdempotentCheckout<StartGroupBuyResult>(
      `group-buy:start:${data.activityId}`,
      data,
      (clientRequestId) => post<StartGroupBuyResult>('/weapp/group-buy/start', {
        ...data,
        clientRequestId,
      }),
    )
    return assertReusableGroupCheckout(result)
  },
  async join(data: JoinGroupBuyInput) {
    const result = await runIdempotentCheckout<StartGroupBuyResult>(
      `group-buy:join:${data.groupId}`,
      data,
      (clientRequestId) => post<StartGroupBuyResult>('/weapp/group-buy/join', {
        ...data,
        clientRequestId,
      }),
    )
    return assertReusableGroupCheckout(result)
  },
}
