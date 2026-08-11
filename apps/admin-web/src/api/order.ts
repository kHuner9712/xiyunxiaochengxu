import request from '@/utils/request'

export const orderApi = {
  getList(params: { page: number; pageSize: number; orderNo?: string; status?: string; startDate?: string; endDate?: string; fulfillmentType?: string }) {
    return request.get('/admin/order/list', { params })
  },
  getDetail(id: string) {
    return request.get(`/admin/order/detail/${encodeURIComponent(id)}`)
  },
  remark(id: string, remark: string) {
    return request.put(`/admin/order/remark/${encodeURIComponent(id)}`, { remark })
  },
  cancel(id: string, reason: string) {
    return request.put(`/admin/order/cancel/${encodeURIComponent(id)}`, { reason })
  },
  getDeliveryList(params: { page: number; pageSize: number; orderNo?: string }) {
    return request.get('/admin/order/delivery-list', { params })
  },
  deliver(data: { orderId: string; logisticsCompany: string; logisticsNo: string }) {
    return request.post('/admin/order/deliver', data)
  },
  batchDeliver(data: { orders: { orderId: string; logisticsCompany: string; logisticsNo: string }[] }) {
    return request.post('/admin/order/batch-deliver', data)
  },
  export(params: { orderNo?: string; status?: string; startDate?: string; endDate?: string; fulfillmentType?: string }) {
    return request.get('/admin/order/export', { params, responseType: 'blob' })
  },
}
