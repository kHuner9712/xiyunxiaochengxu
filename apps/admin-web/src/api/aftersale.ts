import request from '@/utils/request'

export const aftersaleApi = {
  getList(params: { page: number; pageSize: number; status?: string }) {
    return request.get('/admin/aftersale/list', { params })
  },
  getDetail(id: string) {
    return request.get(`/admin/aftersale/detail/${encodeURIComponent(id)}`)
  },
  approve(id: string, refundAmount: number) {
    return request.put(`/admin/aftersale/${encodeURIComponent(id)}/approve`, { refundAmount })
  },
  reject(id: string, rejectReason: string) {
    return request.put(`/admin/aftersale/${encodeURIComponent(id)}/reject`, { rejectReason })
  },
  refund(id: string) {
    return request.put(`/admin/aftersale/${encodeURIComponent(id)}/refund`)
  },
}
