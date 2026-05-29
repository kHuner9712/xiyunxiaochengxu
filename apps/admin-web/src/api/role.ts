import request from '@/utils/request'

export const roleApi = {
  getList(params: { page: number; pageSize: number; name?: string }) {
    return request.get('/admin/role', { params })
  },
  getDetail(id: number) {
    return request.get(`/admin/role/${id}`)
  },
  create(data: any) {
    return request.post('/admin/role', data)
  },
  update(idOrData: number | any, data?: any) {
    const id = typeof idOrData === 'number' ? idOrData : idOrData.id
    const payload = typeof idOrData === 'number' ? (data || {}) : { ...(idOrData || {}) }
    delete payload.id
    return request.put(`/admin/role/${id}`, payload)
  },
  delete(id: number) {
    return request.delete(`/admin/role/${id}`)
  },
  getPermissions() {
    return request.get('/admin/permission/tree')
  },
}
