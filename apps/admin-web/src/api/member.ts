import request from '@/utils/request'

export const memberApi = {
  getList() {
    return request.get('/admin/member/levels')
  },
  create(data: any) {
    return request.post('/admin/member/levels', data)
  },
  update(data: any) {
    return request.put(`/admin/member/levels/${data.id}`, data)
  },
}
