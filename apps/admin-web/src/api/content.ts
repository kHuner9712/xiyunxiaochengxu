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
  update(data: any) {
    return request.put(`/admin/content/${data.id}`, data)
  },
  delete(id: number) {
    return request.delete(`/admin/content/${id}`)
  },
}
