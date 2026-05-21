import request from '@/utils/request'

export const aftersaleApi = {
  getList(params: { page: number; pageSize: number; orderNo?: string; status?: number; type?: number }) {
    return request.get('/admin/aftersale/list', { params })
  },
  getDetail(id: number) {
    return request.get(`/admin/aftersale/detail/${id}`)
  },
  approve(id: number) {
    return request.put(`/admin/aftersale/${id}/approve`)
  },
  reject(id: number, reason: string) {
    return request.put(`/admin/aftersale/${id}/reject`, { reason })
  },
  refund(id: number, refundAmount: number) {
    return request.put(`/admin/aftersale/${id}/refund`, { refundAmount })
  },
}
