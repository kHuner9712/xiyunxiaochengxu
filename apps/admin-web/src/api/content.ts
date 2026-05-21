import request from '@/utils/request'

export const contentApi = {
  getList(params: { page: number; pageSize: number; title?: string; type?: number; status?: number }) {
    return request.get('/admin/content/list', { params })
  },
  getDetail(id: number) {
    return request.get(`/admin/content/detail/${id}`)
  },
  create(data: any) {
    return request.post('/admin/content/create', data)
  },
  update(data: any) {
    return request.put(`/admin/content/update/${data.id}`, data)
  },
  delete(id: number) {
    return request.delete(`/admin/content/delete/${id}`)
  },
  updateStatus(id: number, status: number) {
    return request.put(`/admin/content/status/${id}`, { status })
  },
}
