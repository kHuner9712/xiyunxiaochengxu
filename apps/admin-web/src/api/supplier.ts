import request from '@/utils/request'

export const supplierApi = {
  getList(params: { page: number; pageSize: number; name?: string; contactPhone?: string }) {
    return request.get('/admin/supplier/list', { params })
  },
  getDetail(id: number) {
    return request.get(`/admin/supplier/detail/${id}`)
  },
  create(data: any) {
    return request.post('/admin/supplier/create', data)
  },
  update(idOrData: number | any, data?: any) {
    const id = typeof idOrData === 'number' ? idOrData : idOrData.id
    const payload = typeof idOrData === 'number' ? (data || {}) : { ...(idOrData || {}) }
    delete payload.id
    return request.put(`/admin/supplier/update/${id}`, payload)
  },
  delete(id: number) {
    return request.delete(`/admin/supplier/delete/${id}`)
  },
}
