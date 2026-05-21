import request from '@/utils/request'

export const brandApi = {
  getList(params: { page: number; pageSize: number; name?: string }) {
    return request.get('/admin/brand/list', { params })
  },
  getDetail(id: number) {
    return request.get(`/admin/brand/detail/${id}`)
  },
  create(data: any) {
    return request.post('/admin/brand/create', data)
  },
  update(data: any) {
    return request.put(`/admin/brand/update/${data.id}`, data)
  },
  delete(id: number) {
    return request.delete(`/admin/brand/delete/${id}`)
  },
}
