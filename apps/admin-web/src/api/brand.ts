import request from '@/utils/request'

export const brandApi = {
  getList(params: { page: number; pageSize: number; keyword?: string }) {
    return request.get('/admin/brand/list', { params })
  },
  getDetail(id: number) {
    return request.get(`/admin/brand/detail/${id}`)
  },
  create(data: any) {
    return request.post('/admin/brand/create', data)
  },
  update(idOrData: number | any, data?: any) {
    const id = typeof idOrData === 'number' ? idOrData : idOrData.id
    const payload = typeof idOrData === 'number' ? (data || {}) : { ...(idOrData || {}) }
    delete payload.id
    return request.put(`/admin/brand/update/${id}`, payload)
  },
  delete(id: number) {
    return request.delete(`/admin/brand/delete/${id}`)
  },
}
