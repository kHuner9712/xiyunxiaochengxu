import request from '@/utils/request'

export const adminApi = {
  getList(params: { page: number; pageSize: number; username?: string; status?: number }) {
    return request.get('/admin/admin-user', { params })
  },
  getDetail(id: number) {
    return request.get(`/admin/admin-user/${id}`)
  },
  create(data: any) {
    return request.post('/admin/admin-user', data)
  },
  update(idOrData: number | any, data?: any) {
    const id = typeof idOrData === 'number' ? idOrData : idOrData.id
    const payload = typeof idOrData === 'number' ? (data || {}) : { ...(idOrData || {}) }
    delete payload.id
    return request.put(`/admin/admin-user/${id}`, payload)
  },
  delete(id: number) {
    return request.delete(`/admin/admin-user/${id}`)
  },
  updateStatus(id: number, status: number) {
    return request.put(`/admin/admin-user/${id}/status`, { status })
  },
}
