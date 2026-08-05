import request from '@/utils/request'

export const contentApi = {
  getList(params: { page: number; pageSize: number; title?: string; contentType?: string; placement?: string; status?: number }) {
    return request.get('/admin/content/list', { params })
  },
  getCategories() {
    return request.get('/weapp/content/categories')
  },
  getDetail(id: string | number) {
    return request.get(`/admin/content/${id}`)
  },
  create(data: any) {
    return request.post('/admin/content', data)
  },
  update(idOrData: string | number | any, data?: any) {
    const isDirectId = typeof idOrData === 'number' || typeof idOrData === 'string'
    const id = isDirectId ? idOrData : idOrData.id
    const payload = isDirectId ? (data || {}) : { ...(idOrData || {}) }
    delete payload.id
    return request.put(`/admin/content/${id}`, payload)
  },
  delete(id: string | number) {
    return request.delete(`/admin/content/${id}`)
  },
}
