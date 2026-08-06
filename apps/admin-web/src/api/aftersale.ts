import request from '@/utils/request'

type Id = string | number

export const aftersaleApi = {
  getList(params: { page: number; pageSize: number; orderNo?: string; status?: number; type?: number }) {
    return request.get('/admin/aftersale/list', { params })
  },
  getDetail(id: Id) {
    return request.get(`/admin/aftersale/detail/${id}`)
  },
  approve(id: Id) {
    return request.put(`/admin/aftersale/${id}/approve`)
  },
  reject(id: Id, reason: string) {
    return request.put(`/admin/aftersale/${id}/reject`, { reason })
  },
  refund(id: Id, refundAmount: number) {
    return request.put(`/admin/aftersale/${id}/refund`, { refundAmount })
  },
}
