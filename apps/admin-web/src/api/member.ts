import request from '@/utils/request'

export const memberApi = {
  getList() {
    return request.get('/admin/member-level/list')
  },
  getDetail(id: number) {
    return request.get(`/admin/member-level/detail/${id}`)
  },
  create(data: any) {
    return request.post('/admin/member-level/create', data)
  },
  update(data: any) {
    return request.put(`/admin/member-level/update/${data.id}`, data)
  },
  delete(id: number) {
    return request.delete(`/admin/member-level/delete/${id}`)
  },
}
