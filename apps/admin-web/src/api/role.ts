import request from '@/utils/request'

export const roleApi = {
  getList(params: { page: number; pageSize: number; name?: string }) {
    return request.get('/admin/role/list', { params })
  },
  getAll() {
    return request.get('/admin/role/all')
  },
  getDetail(id: number) {
    return request.get(`/admin/role/detail/${id}`)
  },
  create(data: any) {
    return request.post('/admin/role/create', data)
  },
  update(data: any) {
    return request.put(`/admin/role/update/${data.id}`, data)
  },
  delete(id: number) {
    return request.delete(`/admin/role/delete/${id}`)
  },
  getPermissions() {
    return request.get('/admin/role/permissions')
  },
}
