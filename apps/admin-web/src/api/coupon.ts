import request from '@/utils/request'

export const couponApi = {
  getList(params: { page: number; pageSize: number; name?: string; type?: number; status?: number }) {
    return request.get('/admin/coupon/list', { params })
  },
  getDetail(id: number) {
    return request.get(`/admin/coupon/detail/${id}`)
  },
  create(data: any) {
    return request.post('/admin/coupon/create', data)
  },
  update(data: any) {
    return request.put(`/admin/coupon/update/${data.id}`, data)
  },
  delete(id: number) {
    return request.delete(`/admin/coupon/delete/${id}`)
  },
  updateStatus(id: number, status: number) {
    return request.put(`/admin/coupon/status/${id}`, { status })
  },
}
