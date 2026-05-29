import request from '@/utils/request'

export const activityApi = {
  getList(params: { page: number; pageSize: number; name?: string; status?: number }) {
    return request.get('/admin/activity/list', { params })
  },
  getDetail(id: number) {
    return request.get(`/admin/activity/${id}`)
  },
  create(data: any) {
    return request.post('/admin/activity', data)
  },
  update(idOrData: number | any, data?: any) {
    const id = typeof idOrData === 'number' ? idOrData : idOrData.id
    const payload = typeof idOrData === 'number' ? (data || {}) : { ...(idOrData || {}) }
    delete payload.id
    return request.put(`/admin/activity/${id}`, payload)
  },
  delete(id: number) {
    return request.delete(`/admin/activity/${id}`)
  },
  updateStatus(id: number, status: number) {
    return request.put(`/admin/activity/${id}/status`, { status })
  },
}
