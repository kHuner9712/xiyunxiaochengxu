import request from '@/utils/request'

export const categoryApi = {
  getTree() {
    return request.get('/admin/category/tree')
  },
  getDetail(id: number) {
    return request.get(`/admin/category/detail/${id}`)
  },
  create(data: any) {
    return request.post('/admin/category/create', data)
  },
  update(data: any) {
    return request.put(`/admin/category/update/${data.id}`, data)
  },
  delete(id: number) {
    return request.delete(`/admin/category/delete/${id}`)
  },
  updateSort(data: { id: number; sort: number }[]) {
    return request.put('/admin/category/sort', data)
  },
}
