import request from '@/utils/request'
import { runSingleFlight } from '@/utils/single-flight'

export interface ActivityProductPayload {
  productId: string
  skuId?: string
  activityPrice?: number
  activityStock?: number
  limitPerUser?: number
}

export interface ActivityPayload {
  name?: string
  type?: '1' | '2' | '3' | '4' | '5'
  description?: string
  rules?: Record<string, unknown>
  bannerImage?: string
  startTime?: string
  endTime?: string
  products?: ActivityProductPayload[]
  clientRequestId?: string
}

const PENDING_ACTIVITY_CREATE_KEY = 'baby_mall_admin_pending_activity_create_request_id'
const POSITIVE_ID = /^[1-9]\d*$/
let memoryPendingCreateRequestId = ''

function createActivityRequestId() {
  const cryptoApi = globalThis.crypto
  if (cryptoApi?.getRandomValues) {
    const words = new Uint32Array(2)
    cryptoApi.getRandomValues(words)
    const value = (BigInt(words[0] & 0x7fffffff) << 32n) | BigInt(words[1])
    if (value > 0n) return value.toString()
  }
  return (BigInt(Date.now()) * 1_000_000n + BigInt(Math.floor(Math.random() * 1_000_000))).toString()
}

function readPendingActivityCreateRequestId() {
  if (POSITIVE_ID.test(memoryPendingCreateRequestId)) return memoryPendingCreateRequestId
  if (typeof window === 'undefined') return ''
  try {
    const stored = window.sessionStorage.getItem(PENDING_ACTIVITY_CREATE_KEY) || ''
    if (!POSITIVE_ID.test(stored)) return ''
    memoryPendingCreateRequestId = stored
    return stored
  } catch {
    return ''
  }
}

function getOrCreateActivityCreateRequestId() {
  const existing = readPendingActivityCreateRequestId()
  if (existing) return existing
  const requestId = createActivityRequestId()
  memoryPendingCreateRequestId = requestId
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(PENDING_ACTIVITY_CREATE_KEY, requestId)
    } catch {}
  }
  return requestId
}

function clearPendingActivityCreateRequestId(requestId: string) {
  if (memoryPendingCreateRequestId === requestId) memoryPendingCreateRequestId = ''
  if (typeof window !== 'undefined') {
    try {
      if (window.sessionStorage.getItem(PENDING_ACTIVITY_CREATE_KEY) === requestId) {
        window.sessionStorage.removeItem(PENDING_ACTIVITY_CREATE_KEY)
      }
    } catch {}
  }
}

export const activityApi = {
  getList(params: { page: number; pageSize: number; name?: string; status?: number; type?: string }) {
    return request.get('/admin/activity/list', { params })
  },
  getDetail(id: string) {
    return request.get(`/admin/activity/${encodeURIComponent(id)}`)
  },
  create(data: ActivityPayload) {
    const clientRequestId = getOrCreateActivityCreateRequestId()
    return runSingleFlight('admin:activity:create', async () => {
      try {
        const response = await request.post('/admin/activity', { ...data, clientRequestId })
        clearPendingActivityCreateRequestId(clientRequestId)
        return response
      } catch (error: any) {
        const status = Number(error?.response?.status || 0)
        if (status >= 400 && status < 500) {
          clearPendingActivityCreateRequestId(clientRequestId)
        }
        throw error
      }
    })
  },
  update(id: string, data: ActivityPayload) {
    const { clientRequestId: _ignored, ...payload } = data
    return runSingleFlight(`admin:activity:update:${id}`, () =>
      request.put(`/admin/activity/${encodeURIComponent(id)}`, payload),
    )
  },
  delete(id: string) {
    return runSingleFlight(`admin:activity:delete:${id}`, () =>
      request.delete(`/admin/activity/${encodeURIComponent(id)}`),
    )
  },
  updateStatus(id: string, status: 0 | 1 | 2) {
    return runSingleFlight(`admin:activity:status:${id}`, () =>
      request.put(`/admin/activity/${encodeURIComponent(id)}/status`, { status }),
    )
  },
}
