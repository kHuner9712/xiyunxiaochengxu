import { get, post } from '@/utils/request'

export interface GroupBuyActivity {
  id: string
  name: string
  productId: string
  skuId?: string
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
}

export interface GroupBuyGroup {
  id: string
  activityId: string
  leaderUserId: string
  status: string
  groupNo: string
  currentCount: number
  targetCount: number
  expiresAt: string
  successAt?: string
  failedAt?: string
  createdAt: string
  members?: any[]
  leader?: { id: string; nickname: string; avatar: string } | null
  activity?: { id: string; name: string; coverImage?: string; groupPrice: number; groupSize: number } | null
}

export interface StartGroupBuyResult {
  groupId: string
  groupNo: string
  orderId: string
  role: string
}

export const groupBuyApi = {
  getList(params: { page?: number; pageSize?: number }) {
    return get<{ list: GroupBuyActivity[]; total: number }>('/weapp/group-buy/list', params)
  },
  getDetail(id: string | number) {
    return get<GroupBuyActivity>(`/weapp/group-buy/detail/${id}`)
  },
  getAvailableGroups(activityId: string | number) {
    return get<GroupBuyGroup[]>('/weapp/group-buy/available-groups', { activityId })
  },
  getMyGroups(params: { page?: number; pageSize?: number }) {
    return get<{ list: GroupBuyGroup[]; total: number }>('/weapp/group-buy/my-groups', params)
  },
  getGroupDetail(id: string | number) {
    return get<GroupBuyGroup>(`/weapp/group-buy/group/${id}`)
  },
  start(data: {
    activityId: number
    skuId?: number
    quantity?: number
    addressId?: string
    pickupStoreId?: string
    fulfillmentType?: string
    remark?: string
  }) {
    return post<StartGroupBuyResult>('/weapp/group-buy/start', data)
  },
  join(data: {
    groupId: number
    quantity?: number
    addressId?: string
    pickupStoreId?: string
    fulfillmentType?: string
    remark?: string
  }) {
    return post<StartGroupBuyResult>('/weapp/group-buy/join', data)
  },
}
