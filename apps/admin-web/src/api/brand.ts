import request from '@/utils/request'

type BrandMutation = { id: string; [key: string]: any }

export const brandApi = {
  getList(params: { page: number; pageSize: number; keyword?: string }) {
    return request.get('/admin/brand/list', { params })
  },
  getDetail(id: string) {
    return request.get(`/admin/brand/detail/${encodeURIComponent(id)}`)
  },
  create(data: any) {
    return request.post('/admin/brand/create', data)
  },
  update(idOrData: string | BrandMutation, data?: any) {
    const id = typeof idOrData === 'string' ? idOrData : idOrData.id
    const payload = typeof idOrData === 'string' ? (data || {}) : { ...(idOrData || {}) }
    delete payload.id
    return request.put(`/admin/brand/update/${encodeURIComponent(id)}`, payload)
  },
  delete(id: string) {
    return request.delete(`/admin/brand/delete/${encodeURIComponent(id)}`)
  },
}
