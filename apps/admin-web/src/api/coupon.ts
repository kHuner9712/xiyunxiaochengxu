import request from '@/utils/request'
import { runSingleFlight } from '@/utils/single-flight'

export type CouponId = string

export interface CouponPayload {
  name: string
  type: 1 | 2 | 3
  value: number
  minAmount?: number
  discountLimit?: number
  totalCount?: number
  perLimit?: number
  startTime: string
  endTime: string
  validDays?: number
  applicableType?: 0 | 1 | 2
  applicableIds?: string[]
  description?: string
  memberLevelId?: string | 0
  isNewUser?: 0 | 1
  status?: 0 | 1
  clientRequestId?: string
}

export interface CouponRecord extends CouponPayload {
  id: string
  receivedCount: number
  usedCount: number
  status: 0 | 1
  createdAt: string
  updatedAt: string
  remainCount?: number
}

const PENDING_COUPON_CREATE_KEY = 'baby_mall_admin_pending_coupon_create_request_id'
const POSITIVE_ID = /^[1-9]\d*$/
let memoryPendingCreateRequestId = ''

function createCouponRequestId() {
  const cryptoApi = globalThis.crypto
  if (cryptoApi?.getRandomValues) {
    const words = new Uint32Array(2)
    cryptoApi.getRandomValues(words)
    const value = (BigInt(words[0] & 0x7fffffff) << 32n) | BigInt(words[1])
    if (value > 0n) return value.toString()
  }
  return (BigInt(Date.now()) * 1_000_000n + BigInt(Math.floor(Math.random() * 1_000_000))).toString()
}

function readPendingCouponCreateRequestId() {
  if (POSITIVE_ID.test(memoryPendingCreateRequestId)) return memoryPendingCreateRequestId
  if (typeof window === 'undefined') return ''
  try {
    const stored = window.sessionStorage.getItem(PENDING_COUPON_CREATE_KEY) || ''
    if (!POSITIVE_ID.test(stored)) return ''
    memoryPendingCreateRequestId = stored
    return stored
  } catch {
    return ''
  }
}

function getOrCreateCouponCreateRequestId() {
  const existing = readPendingCouponCreateRequestId()
  if (existing) return existing
  const requestId = createCouponRequestId()
  memoryPendingCreateRequestId = requestId
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(PENDING_COUPON_CREATE_KEY, requestId)
    } catch {}
  }
  return requestId
}

function clearPendingCouponCreateRequestId(requestId: string) {
  if (memoryPendingCreateRequestId === requestId) memoryPendingCreateRequestId = ''
  if (typeof window !== 'undefined') {
    try {
      if (window.sessionStorage.getItem(PENDING_COUPON_CREATE_KEY) === requestId) {
        window.sessionStorage.removeItem(PENDING_COUPON_CREATE_KEY)
      }
    } catch {}
  }
}

export const couponApi = {
  getList(params: { page: number; pageSize: number; name?: string; type?: number; status?: number }) {
    return request.get('/admin/coupon/list', { params })
  },
  getDetail(id: CouponId) {
    return request.get(`/admin/coupon/${encodeURIComponent(id)}`)
  },
  create(data: CouponPayload) {
    const clientRequestId = getOrCreateCouponCreateRequestId()
    return runSingleFlight('admin:coupon:create', async () => {
      try {
        const response = await request.post('/admin/coupon', { ...data, clientRequestId })
        clearPendingCouponCreateRequestId(clientRequestId)
        return response
      } catch (error: any) {
        const status = Number(error?.response?.status || 0)
        if (status >= 400 && status < 500) {
          clearPendingCouponCreateRequestId(clientRequestId)
        }
        throw error
      }
    })
  },
  update(id: CouponId, data: Partial<CouponPayload>) {
    const { clientRequestId: _ignored, ...payload } = data
    return runSingleFlight(`admin:coupon:update:${id}`, () =>
      request.put(`/admin/coupon/${encodeURIComponent(id)}`, payload),
    )
  },
  delete(id: CouponId) {
    return runSingleFlight(`admin:coupon:delete:${id}`, () =>
      request.delete(`/admin/coupon/${encodeURIComponent(id)}`),
    )
  },
}
