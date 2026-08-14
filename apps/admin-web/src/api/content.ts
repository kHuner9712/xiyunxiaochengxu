import request from '@/utils/request'
import { runSingleFlight } from '@/utils/single-flight'

type ContentUpdateInput = string | ({ id: string } & Record<string, any>)

const PENDING_CONTENT_CREATE_KEY = 'baby_mall_admin_pending_content_create_request_id'
const POSITIVE_ID = /^[1-9]\d*$/
let memoryPendingCreateRequestId = ''

function createContentRequestId() {
  const cryptoApi = globalThis.crypto
  if (cryptoApi?.getRandomValues) {
    const words = new Uint32Array(2)
    cryptoApi.getRandomValues(words)
    const value = (BigInt(words[0] & 0x7fffffff) << 32n) | BigInt(words[1])
    if (value > 0n) return value.toString()
  }
  return (BigInt(Date.now()) * 1_000_000n + BigInt(Math.floor(Math.random() * 1_000_000))).toString()
}

function readPendingContentCreateRequestId() {
  if (POSITIVE_ID.test(memoryPendingCreateRequestId)) return memoryPendingCreateRequestId
  if (typeof window === 'undefined') return ''
  try {
    const stored = window.sessionStorage.getItem(PENDING_CONTENT_CREATE_KEY) || ''
    if (!POSITIVE_ID.test(stored)) return ''
    memoryPendingCreateRequestId = stored
    return stored
  } catch {
    return ''
  }
}

function getOrCreateContentCreateRequestId() {
  const existing = readPendingContentCreateRequestId()
  if (existing) return existing
  const requestId = createContentRequestId()
  memoryPendingCreateRequestId = requestId
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(PENDING_CONTENT_CREATE_KEY, requestId)
    } catch {}
  }
  return requestId
}

function clearPendingContentCreateRequestId(requestId: string) {
  if (memoryPendingCreateRequestId === requestId) memoryPendingCreateRequestId = ''
  if (typeof window !== 'undefined') {
    try {
      if (window.sessionStorage.getItem(PENDING_CONTENT_CREATE_KEY) === requestId) {
        window.sessionStorage.removeItem(PENDING_CONTENT_CREATE_KEY)
      }
    } catch {}
  }
}

export const contentApi = {
  getList(params: { page: number; pageSize: number; title?: string; contentType?: string; placement?: string; status?: number }) {
    return request.get('/admin/content/list', { params })
  },
  getCategories() {
    return request.get('/weapp/content/categories')
  },
  getDetail(id: string) {
    return request.get(`/admin/content/${encodeURIComponent(id)}`)
  },
  create(data: any) {
    const clientRequestId = getOrCreateContentCreateRequestId()
    return runSingleFlight('admin:content:create', async () => {
      try {
        const response = await request.post('/admin/content', { ...data, clientRequestId })
        clearPendingContentCreateRequestId(clientRequestId)
        return response
      } catch (error: any) {
        const status = Number(error?.response?.status || 0)
        if (status >= 400 && status < 500) {
          clearPendingContentCreateRequestId(clientRequestId)
        }
        throw error
      }
    })
  },
  update(idOrData: ContentUpdateInput, data?: any) {
    const isDirectId = typeof idOrData === 'string'
    const id = isDirectId ? idOrData : idOrData.id
    const payload = isDirectId ? (data || {}) : { ...idOrData }
    delete payload.id
    return runSingleFlight(`admin:content:update:${id}`, () =>
      request.put(`/admin/content/${encodeURIComponent(id)}`, payload),
    )
  },
  delete(id: string) {
    return runSingleFlight(`admin:content:delete:${id}`, () =>
      request.delete(`/admin/content/${encodeURIComponent(id)}`),
    )
  },
}
