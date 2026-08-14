import request from '@/utils/request'
import { runSingleFlight } from '@/utils/single-flight'

const PENDING_GROUP_BUY_ACTIVITY_CREATE_KEY = 'baby_mall_admin_pending_group_buy_activity_create_request_id'
const POSITIVE_ID = /^[1-9]\d*$/
let memoryPendingCreateRequestId = ''
const activeActivityMutations = new Map<string, { operation: string; promise: Promise<unknown> }>()

function createAdminRequestId() {
  const cryptoApi = globalThis.crypto
  if (cryptoApi?.getRandomValues) {
    const words = new Uint32Array(2)
    cryptoApi.getRandomValues(words)
    const value = (BigInt(words[0] & 0x7fffffff) << 32n) | BigInt(words[1])
    if (value > 0n) return value.toString()
  }
  return (BigInt(Date.now()) * 1_000_000n + BigInt(Math.floor(Math.random() * 1_000_000))).toString()
}

function readPendingCreateRequestId() {
  if (POSITIVE_ID.test(memoryPendingCreateRequestId)) return memoryPendingCreateRequestId
  if (typeof window === 'undefined') return ''
  try {
    const stored = window.sessionStorage.getItem(PENDING_GROUP_BUY_ACTIVITY_CREATE_KEY) || ''
    if (!POSITIVE_ID.test(stored)) return ''
    memoryPendingCreateRequestId = stored
    return stored
  } catch {
    return ''
  }
}

function getOrCreateRequestId() {
  const existing = readPendingCreateRequestId()
  if (existing) return existing
  const requestId = createAdminRequestId()
  memoryPendingCreateRequestId = requestId
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(PENDING_GROUP_BUY_ACTIVITY_CREATE_KEY, requestId)
    } catch {}
  }
  return requestId
}

function clearPendingCreateRequestId(requestId: string) {
  if (memoryPendingCreateRequestId === requestId) memoryPendingCreateRequestId = ''
  if (typeof window !== 'undefined') {
    try {
      if (window.sessionStorage.getItem(PENDING_GROUP_BUY_ACTIVITY_CREATE_KEY) === requestId) {
        window.sessionStorage.removeItem(PENDING_GROUP_BUY_ACTIVITY_CREATE_KEY)
      }
    } catch {}
  }
}

function runActivityMutation<T>(id: string, operation: string, factory: () => Promise<T>): Promise<T> {
  const existing = activeActivityMutations.get(id)
  if (existing) {
    if (existing.operation === operation) return existing.promise as Promise<T>
    return Promise.reject(new Error('该拼团活动正在执行其他操作，请稍后重试'))
  }

  const requestPromise = runSingleFlight(`admin:group-buy:activity:${operation}:${id}`, factory)
  const tracked = requestPromise.finally(() => {
    if (activeActivityMutations.get(id)?.promise === tracked) activeActivityMutations.delete(id)
  })
  activeActivityMutations.set(id, { operation, promise: tracked })
  return tracked
}

export const groupBuyApi = {
  getActivities(params: {
    page: number
    pageSize: number
    keyword?: string
    status?: number
    productId?: string
  }) {
    return request.get('/admin/group-buy/activity/list', { params })
  },
  getActivityDetail(id: string) {
    return request.get(`/admin/group-buy/activity/detail/${encodeURIComponent(id)}`)
  },
  createActivity(data: any) {
    const clientRequestId = getOrCreateRequestId()
    return runSingleFlight('admin:group-buy:activity:create', async () => {
      try {
        const response = await request.post('/admin/group-buy/activity/create', {
          ...data,
          clientRequestId,
        })
        clearPendingCreateRequestId(clientRequestId)
        return response
      } catch (error: any) {
        const status = Number(error?.response?.status || 0)
        if (status >= 400 && status < 500) clearPendingCreateRequestId(clientRequestId)
        throw error
      }
    })
  },
  updateActivity(id: string, data: any) {
    const { clientRequestId: _ignored, ...payload } = data || {}
    return runActivityMutation(id, 'update', () =>
      request.put(`/admin/group-buy/activity/update/${encodeURIComponent(id)}`, payload),
    )
  },
  updateActivityStatus(id: string, status: number) {
    return runActivityMutation(id, 'status', () =>
      request.put(`/admin/group-buy/activity/status/${encodeURIComponent(id)}`, { status }),
    )
  },
  deleteActivity(id: string) {
    return runActivityMutation(id, 'delete', () =>
      request.delete(`/admin/group-buy/activity/delete/${encodeURIComponent(id)}`),
    )
  },
  getGroups(params: any) {
    return request.get('/admin/group-buy/groups', { params })
  },
  getGroupDetail(id: string) {
    return request.get(`/admin/group-buy/groups/${encodeURIComponent(id)}`)
  },
  getMembers(params: any) {
    return request.get('/admin/group-buy/members', { params })
  },
  getStats() {
    return request.get('/admin/group-buy/stats')
  },
  markExpired() {
    return request.post('/admin/group-buy/groups/mark-expired')
  },
}
