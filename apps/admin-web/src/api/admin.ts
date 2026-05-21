import request from '@/utils/request'

export const adminApi = {
  getList(params: { page: number; pageSize: number; username?: string; status?: number }) {
    return request.get('/admin/admin/list', { params })
  },
  getDetail(id: number) {
    return request.get(`/admin/admin/detail/${id}`)
  },
  create(data: any) {
    return request.post('/admin/admin/create', data)
  },
  update(data: any) {
    return request.put(`/admin/admin/update/${data.id}`, data)
  },
  delete(id: number) {
    return request.delete(`/admin/admin/delete/${id}`)
  },
  resetPassword(id: number, password: string) {
    return request.put(`/admin/admin/reset-password/${id}`, { password })
  },
  updateStatus(id: number, status: number) {
    return request.put(`/admin/admin/status/${id}`, { status })
  },
}
