import request from '@/utils/request'

export const orderApi = {
  getList(params: { page: number; pageSize: number; orderNo?: string; status?: number; startTime?: string; endTime?: string; userId?: number }) {
    return request.get('/admin/order/list', { params })
  },
  getDetail(id: number) {
    return request.get(`/admin/order/detail/${id}`)
  },
  cancel(id: number, reason: string) {
    return request.put(`/admin/order/cancel/${id}`, { reason })
  },
  getDeliveryList(params: { page: number; pageSize: number }) {
    return request.get('/admin/order/delivery-list', { params })
  },
  deliver(data: { orderId: number; logisticsCompany: string; logisticsNo: string }) {
    return request.post('/admin/order/deliver', data)
  },
  batchDeliver(data: { orders: { orderId: number; logisticsCompany: string; logisticsNo: string }[] }) {
    return request.post('/admin/order/batch-deliver', data)
  },
  export(params: any) {
    return request.get('/admin/order/export', { params, responseType: 'blob' })
  },
}
