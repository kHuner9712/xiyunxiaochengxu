import request from '@/utils/request'
import { runSingleFlight } from '@/utils/single-flight'

const PENDING_PICKUP_STORE_CREATE_KEY = 'baby_mall_admin_pending_pickup_store_create_request_id'
const POSITIVE_ID = /^[1-9]\d*$/
let memoryPendingCreateRequestId = ''

function createPickupStoreRequestId() {
  const cryptoApi = globalThis.crypto
  if (cryptoApi?.getRandomValues) {
    const words = new Uint32Array(2)
    cryptoApi.getRandomValues(words)
    const value = (BigInt(words[0] & 0x7fffffff) << 32n) | BigInt(words[1])
    if (value > 0n) return value.toString()
  }
  return (BigInt(Date.now()) * 1_000_000n + BigInt(Math.floor(Math.random() * 1_000_000))).toString()
}

function readPendingPickupStoreCreateRequestId() {
  if (POSITIVE_ID.test(memoryPendingCreateRequestId)) return memoryPendingCreateRequestId
  if (typeof window === 'undefined') return ''
  try {
    const stored = window.sessionStorage.getItem(PENDING_PICKUP_STORE_CREATE_KEY) || ''
    if (!POSITIVE_ID.test(stored)) return ''
    memoryPendingCreateRequestId = stored
    return stored
  } catch {
    return ''
  }
}

function getOrCreatePickupStoreCreateRequestId() {
  const existing = readPendingPickupStoreCreateRequestId()
  if (existing) return existing
  const requestId = createPickupStoreRequestId()
  memoryPendingCreateRequestId = requestId
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(PENDING_PICKUP_STORE_CREATE_KEY, requestId)
    } catch {}
  }
  return requestId
}

function clearPendingPickupStoreCreateRequestId(requestId: string) {
  if (memoryPendingCreateRequestId === requestId) memoryPendingCreateRequestId = ''
  if (typeof window !== 'undefined') {
    try {
      if (window.sessionStorage.getItem(PENDING_PICKUP_STORE_CREATE_KEY) === requestId) {
        window.sessionStorage.removeItem(PENDING_PICKUP_STORE_CREATE_KEY)
      }
    } catch {}
  }
}

export const pickupStoreApi = {
  getList(params: { page: number; pageSize: number; keyword?: string; status?: number }) {
    return request.get('/admin/pickup-store/list', { params })
  },
  getDetail(id: string) {
    return request.get(`/admin/pickup-store/${encodeURIComponent(id)}`)
  },
  create(data: any) {
    const clientRequestId = getOrCreatePickupStoreCreateRequestId()
    return runSingleFlight('admin:pickup-store:create', async () => {
      try {
        const response = await request.post('/admin/pickup-store', { ...data, clientRequestId })
        clearPendingPickupStoreCreateRequestId(clientRequestId)
        return response
      } catch (error: any) {
        const status = Number(error?.response?.status || 0)
        if (status >= 400 && status < 500) {
          clearPendingPickupStoreCreateRequestId(clientRequestId)
        }
        throw error
      }
    })
  },
  update(id: string, data: any) {
    const { clientRequestId: _ignored, ...payload } = data || {}
    return runSingleFlight(`admin:pickup-store:update:${id}`, () =>
      request.put(`/admin/pickup-store/${encodeURIComponent(id)}`, payload),
    )
  },
  delete(id: string) {
    return runSingleFlight(`admin:pickup-store:delete:${id}`, () =>
      request.delete(`/admin/pickup-store/${encodeURIComponent(id)}`),
    )
  },
  updateStatus(id: string, status: number) {
    return runSingleFlight(`admin:pickup-store:status:${id}`, () =>
      request.put(`/admin/pickup-store/${encodeURIComponent(id)}/status`, { status }),
    )
  },
  verifyPickupCode(pickupCode: string) {
    return runSingleFlight(`admin:pickup-store:verify:${pickupCode}`, () =>
      request.post('/admin/pickup-store/verify', { pickupCode }),
    )
  },
  previewPickupCode(pickupCode: string) {
    return request.get('/admin/pickup-store/preview', { params: { pickupCode } })
  },
}

export interface PickupOrderPreview {
  orderId: string
  orderNo: string
  status: string
  fulfillmentType: string
  totalAmount: number
  payAmount: number
  userName: string
  userPhone: string
  items: Array<{
    id: string
    productName: string
    skuName: string
    productImage: string
    price: number
    quantity: number
    subtotal: number
  }>
  pickupStoreName: string | null
  pickupStoreAddress: string | null
  pickupContactPhone: string | null
  pickupCode: string | null
  pickedUpAt: string | null
  createTime: string
  alreadyCompleted: boolean
}
