import request from '@/utils/request'

export const productApi = {
  getList(params: { page: number; pageSize: number; keyword?: string; categoryId?: number; status?: number; brandId?: number }) {
    return request.get('/admin/product/list', { params })
  },
  getDetail(id: number) {
    return request.get(`/admin/product/detail/${id}`)
  },
  create(data: any) {
    return request.post('/admin/product/create', data)
  },
  update(id: number, data: any) {
    return request.put(`/admin/product/update/${id}`, data)
  },
  delete(id: number) {
    return request.delete(`/admin/product/delete/${id}`)
  },
  updateStatus(id: number, status: number) {
    return request.put(`/admin/product/status/${id}`, { status })
  },
}
