import request from '@/utils/request'

type MerchantPromotionUpdateInput = string | ({ id: string } & Record<string, any>)

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
    return request.get(`/admin/merchant-promotion-source/orders/${encodeURIComponent(promotionCode)}`, { params })
  },
  getDetail(id: string) {
    return request.get(`/admin/merchant-promotion-source/detail/${encodeURIComponent(id)}`)
  },
  create(data: any) {
    return request.post('/admin/merchant-promotion-source/create', data)
  },
  update(idOrData: MerchantPromotionUpdateInput, data?: any) {
    const isObject = typeof idOrData === 'object'
    const id = isObject ? idOrData.id : idOrData
    const payload = isObject ? { ...idOrData } : { ...(data || {}) }
    delete payload.id
    return request.put(`/admin/merchant-promotion-source/update/${encodeURIComponent(id)}`, payload)
  },
  updateStatus(id: string, status: number) {
    return request.put(`/admin/merchant-promotion-source/status/${encodeURIComponent(id)}`, { status })
  },
}
