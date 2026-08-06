import request from '@/utils/request'

type Id = string | number

export const aftersaleApi = {
  getList(params: { page: number; pageSize: number; status?: string }) {
    return request.get('/admin/aftersale/list', { params })
  },
  getDetail(id: Id) {
    return request.get(`/admin/aftersale/detail/${id}`)
  },
  approve(id: Id, refundAmount: number) {
    return request.put(`/admin/aftersale/${id}/approve`, { refundAmount })
  },
  reject(id: Id, rejectReason: string) {
    return request.put(`/admin/aftersale/${id}/reject`, { rejectReason })
  },
  refund(id: Id) {
    return request.put(`/admin/aftersale/${id}/refund`)
  },
}
