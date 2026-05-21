import request from '@/utils/request'

export const bannerApi = {
  getList(params: { page: number; pageSize: number; position?: number }) {
    return request.get('/admin/banner/list', { params })
  },
  getDetail(id: number) {
    return request.get(`/admin/banner/detail/${id}`)
  },
  create(data: any) {
    return request.post('/admin/banner/create', data)
  },
  update(data: any) {
    return request.put(`/admin/banner/update/${data.id}`, data)
  },
  delete(id: number) {
    return request.delete(`/admin/banner/delete/${id}`)
  },
  updateSort(data: { id: number; sort: number }[]) {
    return request.put('/admin/banner/sort', data)
  },
}
