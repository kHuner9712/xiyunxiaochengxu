import request from '@/utils/request'

type Id = string | number

export const productApi = {
  getList(params: { page: number; pageSize: number; keyword?: string; categoryId?: Id; status?: number; brandId?: Id }) {
    return request.get('/admin/product/list', { params })
  },
  getDetail(id: Id) {
    return request.get(`/admin/product/detail/${id}`)
  },
  create(data: any) {
    return request.post('/admin/product/create', data)
  },
  update(id: Id, data: any) {
    return request.put(`/admin/product/update/${id}`, data)
  },
  delete(id: Id) {
    return request.delete(`/admin/product/delete/${id}`)
  },
  updateStatus(id: Id, status: number) {
    return request.put(`/admin/product/status/${id}`, { status })
  },
}
