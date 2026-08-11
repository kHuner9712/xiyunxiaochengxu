import request from '@/utils/request'

export interface AdminPayload {
  username?: string
  password?: string
  realName?: string
  phone?: string
  avatar?: string
  roleIds?: string[]
  status?: 0 | 1
}

export const adminApi = {
  getList(params: { page: number; pageSize: number; username?: string; status?: number }) {
    return request.get('/admin/admin-user', { params })
  },
  getDetail(id: string) {
    return request.get(`/admin/admin-user/${encodeURIComponent(id)}`)
  },
  create(data: AdminPayload) {
    return request.post('/admin/admin-user', data)
  },
  update(id: string, data: AdminPayload) {
    return request.put(`/admin/admin-user/${encodeURIComponent(id)}`, data)
  },
  delete(id: string) {
    return request.delete(`/admin/admin-user/${encodeURIComponent(id)}`)
  },
  updateStatus(id: string, status: 0 | 1) {
    return request.put(`/admin/admin-user/${encodeURIComponent(id)}/status`, { status })
  },
}
