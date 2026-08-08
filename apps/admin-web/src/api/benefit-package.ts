import request from '@/utils/request'

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
    return request.post('/admin/benefit-package/create', data)
  },
  update(id: string, data: any) {
    return request.put(`/admin/benefit-package/update/${encodeURIComponent(id)}`, data)
  },
  updateStatus(id: string, status: number) {
    return request.put(`/admin/benefit-package/status/${encodeURIComponent(id)}`, { status })
  },
  remove(id: string) {
    return request.delete(`/admin/benefit-package/delete/${encodeURIComponent(id)}`)
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
