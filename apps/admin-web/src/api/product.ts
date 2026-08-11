import request from '@/utils/request'

export const productApi = {
  getList(params: { page: number; pageSize: number; keyword?: string; categoryId?: string; status?: number; brandId?: string }) {
    return request.get('/admin/product/list', { params })
  },
  getDetail(id: string) {
    return request.get(`/admin/product/detail/${encodeURIComponent(id)}`)
  },
  create(data: any) {
    return request.post('/admin/product/create', data)
  },
  update(id: string, data: any) {
    return request.put(`/admin/product/update/${encodeURIComponent(id)}`, data)
  },
  delete(id: string) {
    return request.delete(`/admin/product/delete/${encodeURIComponent(id)}`)
  },
  updateStatus(id: string, status: number) {
    return request.put(`/admin/product/status/${encodeURIComponent(id)}`, { status })
  },
}
