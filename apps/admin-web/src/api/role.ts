import request from '@/utils/request'

export interface RolePayload {
  name?: string
  code?: string
  description?: string
  permissionIds?: string[]
}

export const roleApi = {
  getList(_params?: { page?: number; pageSize?: number; name?: string }) {
    return request.get('/admin/role')
  },
  getDetail(id: string) {
    return request.get(`/admin/role/${encodeURIComponent(id)}`)
  },
  create(data: RolePayload) {
    return request.post('/admin/role', data)
  },
  update(id: string, data: RolePayload) {
    return request.put(`/admin/role/${encodeURIComponent(id)}`, data)
  },
  delete(id: string) {
    return request.delete(`/admin/role/${encodeURIComponent(id)}`)
  },
  getPermissions() {
    return request.get('/admin/permission/tree')
  },
}
