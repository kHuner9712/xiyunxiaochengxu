import request from '@/utils/request'

export const couponApi = {
  getList(params: { page: number; pageSize: number; name?: string; type?: number; status?: number }) {
    return request.get('/admin/coupon/list', { params })
  },
  getDetail(id: number) {
    return request.get(`/admin/coupon/${id}`)
  },
  create(data: any) {
    return request.post('/admin/coupon', data)
  },
  update(idOrData: number | any, data?: any) {
    const id = typeof idOrData === 'number' ? idOrData : idOrData.id
    const payload = typeof idOrData === 'number' ? (data || {}) : { ...(idOrData || {}) }
    delete payload.id
    return request.put(`/admin/coupon/${id}`, payload)
  },
  delete(id: number) {
    return request.delete(`/admin/coupon/${id}`)
  },
}
