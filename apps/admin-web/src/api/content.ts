import request from '@/utils/request'

export const contentApi = {
  getList(params: { page: number; pageSize: number; title?: string; type?: number; status?: number }) {
    return request.get('/admin/content/list', { params })
  },
  getDetail(id: number) {
    return request.get(`/admin/content/${id}`)
  },
  create(data: any) {
    return request.post('/admin/content', data)
  },
  update(idOrData: number | any, data?: any) {
    const id = typeof idOrData === 'number' ? idOrData : idOrData.id
    const payload = typeof idOrData === 'number' ? (data || {}) : { ...(idOrData || {}) }
    delete payload.id
    return request.put(`/admin/content/${id}`, payload)
  },
  delete(id: number) {
    return request.delete(`/admin/content/${id}`)
  },
}
