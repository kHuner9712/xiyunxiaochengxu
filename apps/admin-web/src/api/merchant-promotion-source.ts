import request from '@/utils/request'

export const merchantPromotionSourceApi = {
  getList(params: {
    page: number
    pageSize: number
    keyword?: string
    name?: string
    promotionCode?: string
    scene?: string
    status?: number
  }) {
    return request.get('/admin/merchant-promotion-source/list', { params })
  },
  getStats(params: {
    keyword?: string
    name?: string
    promotionCode?: string
    scene?: string
    status?: number
  }) {
    return request.get('/admin/merchant-promotion-source/stats', { params })
  },
  getOrders(promotionCode: string, params: { page: number; pageSize: number }) {
    return request.get(`/admin/merchant-promotion-source/orders/${promotionCode}`, { params })
  },
  getDetail(id: string | number) {
    return request.get(`/admin/merchant-promotion-source/detail/${id}`)
  },
  create(data: any) {
    return request.post('/admin/merchant-promotion-source/create', data)
  },
  update(idOrData: string | number | any, data?: any) {
    const id = typeof idOrData === 'object' ? idOrData.id : idOrData
    const payload = typeof idOrData === 'object' ? { ...(idOrData || {}) } : { ...(data || {}) }
    delete payload.id
    return request.put(`/admin/merchant-promotion-source/update/${id}`, payload)
  },
  updateStatus(id: string | number, status: number) {
    return request.put(`/admin/merchant-promotion-source/status/${id}`, { status })
  },
}
