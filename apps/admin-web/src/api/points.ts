import request from '@/utils/request'

export const pointsApi = {
  getList() {
    return request.get('/admin/points-rule/list')
  },
  getDetail(id: number) {
    return request.get(`/admin/points-rule/detail/${id}`)
  },
  create(data: any) {
    return request.post('/admin/points-rule/create', data)
  },
  update(data: any) {
    return request.put(`/admin/points-rule/update/${data.id}`, data)
  },
  delete(id: number) {
    return request.delete(`/admin/points-rule/delete/${id}`)
  },
}
