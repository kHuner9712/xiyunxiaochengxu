import request from '@/utils/request'

export const bannerApi = {
  getList(params: { page: number; pageSize: number; position?: number }) {
    return request.get('/admin/banner/list', { params })
  },
  create(data: any) {
    return request.post('/admin/banner', data)
  },
  update(data: any) {
    return request.put(`/admin/banner/${data.id}`, data)
  },
  delete(id: number) {
    return request.delete(`/admin/banner/${id}`)
  },
}
