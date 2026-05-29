import request from '@/utils/request'

export const bannerApi = {
  getList(params: { page: number; pageSize: number; position?: number }) {
    return request.get('/admin/banner/list', { params })
  },
  create(data: any) {
    return request.post('/admin/banner', data)
  },
  update(idOrData: number | any, data?: any) {
    const id = typeof idOrData === 'number' ? idOrData : idOrData.id
    const payload = typeof idOrData === 'number' ? (data || {}) : { ...(idOrData || {}) }
    delete payload.id
    return request.put(`/admin/banner/${id}`, payload)
  },
  delete(id: number) {
    return request.delete(`/admin/banner/${id}`)
  },
}
