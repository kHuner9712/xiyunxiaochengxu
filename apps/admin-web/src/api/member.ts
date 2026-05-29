import request from '@/utils/request'

export const memberApi = {
  getList() {
    return request.get('/admin/member/levels')
  },
  create(data: any) {
    return request.post('/admin/member/levels', data)
  },
  update(idOrData: number | any, data?: any) {
    const id = typeof idOrData === 'number' ? idOrData : idOrData.id
    const payload = typeof idOrData === 'number' ? (data || {}) : { ...(idOrData || {}) }
    delete payload.id
    return request.put(`/admin/member/levels/${id}`, payload)
  },
}
