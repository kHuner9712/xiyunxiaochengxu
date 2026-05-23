import request from '@/utils/request'

export const refundApi = {
  getList(params: { page: number; pageSize: number; refundNo?: string; orderId?: string; status?: string }) {
    return request.get('/admin/refund/list', { params })
  },
  getDetail(id: string) {
    return request.get(`/admin/refund/detail/${id}`)
  },
}
