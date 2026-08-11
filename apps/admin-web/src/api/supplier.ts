import request from '@/utils/request'

type SupplierMutation = { id: string; [key: string]: any }

type SupplierListParams = {
  page: number
  pageSize: number
  name?: string
  contactPhone?: string
  status?: number
}

export const supplierApi = {
  getList(params: SupplierListParams) {
    return request.get('/admin/supplier/list', { params })
  },
  getDetail(id: string) {
    return request.get(`/admin/supplier/detail/${encodeURIComponent(id)}`)
  },
  create(data: any) {
    return request.post('/admin/supplier/create', data)
  },
  update(idOrData: string | SupplierMutation, data?: any) {
    const id = typeof idOrData === 'string' ? idOrData : idOrData.id
    const payload = typeof idOrData === 'string' ? (data || {}) : { ...(idOrData || {}) }
    delete payload.id
    return request.put(`/admin/supplier/update/${encodeURIComponent(id)}`, payload)
  },
  delete(id: string) {
    return request.delete(`/admin/supplier/delete/${encodeURIComponent(id)}`)
  },
}
