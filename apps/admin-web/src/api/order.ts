import request from '@/utils/request'

export const orderApi = {
  getList(params: { page: number; pageSize: number; orderNo?: string; status?: string; startDate?: string; endDate?: string; fulfillmentType?: string }) {
    return request.get('/admin/order/list', { params })
  },
  getDetail(id: string | number) {
    return request.get(`/admin/order/detail/${id}`)
  },
  cancel(id: string | number, reason: string) {
    return request.put(`/admin/order/cancel/${id}`, { reason })
  },
  getDeliveryList(params: { page: number; pageSize: number }) {
    return request.get('/admin/order/delivery-list', { params })
  },
  deliver(data: { orderId: string | number; logisticsCompany: string; logisticsNo: string }) {
    return request.post('/admin/order/deliver', data)
  },
  batchDeliver(data: { orders: { orderId: string | number; logisticsCompany: string; logisticsNo: string }[] }) {
    return request.post('/admin/order/batch-deliver', data)
  },
  export(params: { orderNo?: string; status?: string; startDate?: string; endDate?: string; fulfillmentType?: string }) {
    return request.get('/admin/order/export', { params, responseType: 'blob' })
  },
}
