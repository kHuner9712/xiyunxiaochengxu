import request from '@/utils/request'

export const activityApi = {
  getList(params: { page: number; pageSize: number; name?: string; status?: number }) {
    return request.get('/admin/activity/list', { params })
  },
  getDetail(id: number) {
    return request.get(`/admin/activity/detail/${id}`)
  },
  create(data: any) {
    return request.post('/admin/activity/create', data)
  },
  update(data: any) {
    return request.put(`/admin/activity/update/${data.id}`, data)
  },
  delete(id: number) {
    return request.delete(`/admin/activity/delete/${id}`)
  },
  updateStatus(id: number, status: number) {
    return request.put(`/admin/activity/status/${id}`, { status })
  },
}
