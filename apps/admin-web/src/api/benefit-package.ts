import request from '@/utils/request'
import { runSingleFlight } from '@/utils/single-flight'

const PENDING_BENEFIT_PACKAGE_CREATE_KEY = 'baby_mall_admin_pending_benefit_package_create_request_id'
const POSITIVE_ID = /^[1-9]\d*$/
let memoryPendingCreateRequestId = ''

function createBenefitPackageRequestId() {
  const cryptoApi = globalThis.crypto
  if (cryptoApi?.getRandomValues) {
    const words = new Uint32Array(2)
    cryptoApi.getRandomValues(words)
    const value = (BigInt(words[0] & 0x7fffffff) << 32n) | BigInt(words[1])
    if (value > 0n) return value.toString()
  }
  return (BigInt(Date.now()) * 1_000_000n + BigInt(Math.floor(Math.random() * 1_000_000))).toString()
}

function readPendingBenefitPackageCreateRequestId() {
  if (POSITIVE_ID.test(memoryPendingCreateRequestId)) return memoryPendingCreateRequestId
  if (typeof window === 'undefined') return ''
  try {
    const stored = window.sessionStorage.getItem(PENDING_BENEFIT_PACKAGE_CREATE_KEY) || ''
    if (!POSITIVE_ID.test(stored)) return ''
    memoryPendingCreateRequestId = stored
    return stored
  } catch {
    return ''
  }
}

function getOrCreateBenefitPackageRequestId() {
  const existing = readPendingBenefitPackageCreateRequestId()
  if (existing) return existing
  const requestId = createBenefitPackageRequestId()
  memoryPendingCreateRequestId = requestId
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(PENDING_BENEFIT_PACKAGE_CREATE_KEY, requestId)
    } catch {}
  }
  return requestId
}

function clearPendingBenefitPackageCreateRequestId(requestId: string) {
  if (memoryPendingCreateRequestId === requestId) memoryPendingCreateRequestId = ''
  if (typeof window !== 'undefined') {
    try {
      if (window.sessionStorage.getItem(PENDING_BENEFIT_PACKAGE_CREATE_KEY) === requestId) {
        window.sessionStorage.removeItem(PENDING_BENEFIT_PACKAGE_CREATE_KEY)
      }
    } catch {}
  }
}

function mutationKey(id: string) {
  return `admin:benefit-package:mutation:${id}`
}

export const benefitPackageApi = {
  getList(params: {
    page: number
    pageSize: number
    keyword?: string
    status?: number
  }) {
    return request.get('/admin/benefit-package/list', { params })
  },
  getDetail(id: string) {
    return request.get(`/admin/benefit-package/detail/${encodeURIComponent(id)}`)
  },
  create(data: any) {
    const clientRequestId = getOrCreateBenefitPackageRequestId()
    return runSingleFlight('admin:benefit-package:create', async () => {
      try {
        const response = await request.post('/admin/benefit-package/create', {
          ...data,
          clientRequestId,
        })
        clearPendingBenefitPackageCreateRequestId(clientRequestId)
        return response
      } catch (error: any) {
        const status = Number(error?.response?.status || 0)
        if (status >= 400 && status < 500) {
          clearPendingBenefitPackageCreateRequestId(clientRequestId)
        }
        throw error
      }
    })
  },
  update(id: string, data: any) {
    const { clientRequestId: _ignored, ...payload } = data || {}
    return runSingleFlight(mutationKey(id), () =>
      request.put(`/admin/benefit-package/update/${encodeURIComponent(id)}`, payload),
    )
  },
  updateStatus(id: string, status: number) {
    return runSingleFlight(mutationKey(id), () =>
      request.put(`/admin/benefit-package/status/${encodeURIComponent(id)}`, { status }),
    )
  },
  remove(id: string) {
    return runSingleFlight(mutationKey(id), () =>
      request.delete(`/admin/benefit-package/delete/${encodeURIComponent(id)}`),
    )
  },
  getUserPackages(params: any) {
    return request.get('/admin/benefit-package/user-packages', { params })
  },
  getEntitlements(params: any) {
    return request.get('/admin/benefit-package/entitlements', { params })
  },
  verifyPreview(verifyCode: string) {
    return request.get('/admin/benefit-package/verify/preview', { params: { verifyCode } })
  },
  verify(data: { verifyCode: string; remark?: string }) {
    return request.post('/admin/benefit-package/verify', data)
  },
  getVerificationLogs(params: any) {
    return request.get('/admin/benefit-package/verification-logs', { params })
  },
  getStats() {
    return request.get('/admin/benefit-package/stats')
  },
}
