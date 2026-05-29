import request from '@/utils/request'

export const categoryApi = {
  getTree() {
    return request.get('/admin/category/list')
  },
  getDetail(id: number) {
    return request.get(`/admin/category/detail/${id}`)
  },
  create(data: any) {
    return request.post('/admin/category/create', data)
  },
  update(id: number, data: any) {
    return request.put(`/admin/category/update/${id}`, data)
  },
  delete(id: number) {
    return request.delete(`/admin/category/delete/${id}`)
  },
}
