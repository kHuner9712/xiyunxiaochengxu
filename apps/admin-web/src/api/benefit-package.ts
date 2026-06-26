import request from '@/utils/request'

export const benefitPackageApi = {
  // 权益包配置
  getList(params: {
    page: number
    pageSize: number
    keyword?: string
    status?: number
  }) {
    return request.get('/admin/benefit-package/list', { params })
  },
  getDetail(id: string | number) {
    return request.get(`/admin/benefit-package/detail/${id}`)
  },
  create(data: any) {
    return request.post('/admin/benefit-package/create', data)
  },
  update(id: string | number, data: any) {
    return request.put(`/admin/benefit-package/update/${id}`, data)
  },
  updateStatus(id: string | number, status: number) {
    return request.put(`/admin/benefit-package/status/${id}`, { status })
  },
  remove(id: string | number) {
    return request.delete(`/admin/benefit-package/delete/${id}`)
  },
  // 用户权益 / 核销 / 记录
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
