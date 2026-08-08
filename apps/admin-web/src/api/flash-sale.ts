import request from '@/utils/request'

export const flashSaleApi = {
  getActivities(params: {
    page: number
    pageSize: number
    keyword?: string
    status?: number
    productId?: string
  }) {
    return request.get('/admin/flash-sale/activity/list', { params })
  },
  getActivityDetail(id: string) {
    return request.get(`/admin/flash-sale/activity/detail/${encodeURIComponent(id)}`)
  },
  createActivity(data: any) {
    return request.post('/admin/flash-sale/activity/create', data)
  },
  updateActivity(id: string, data: any) {
    return request.put(`/admin/flash-sale/activity/update/${encodeURIComponent(id)}`, data)
  },
  updateActivityStatus(id: string, status: number) {
    return request.put(`/admin/flash-sale/activity/status/${encodeURIComponent(id)}`, { status })
  },
  deleteActivity(id: string) {
    return request.delete(`/admin/flash-sale/activity/delete/${encodeURIComponent(id)}`)
  },
  getOrders(params: any) {
    return request.get('/admin/flash-sale/orders', { params })
  },
  getOrderDetail(id: string) {
    return request.get(`/admin/flash-sale/orders/${encodeURIComponent(id)}`)
  },
  getStats() {
    return request.get('/admin/flash-sale/stats')
  },
  releaseExpiredLocks() {
    return request.put('/admin/flash-sale/release-expired-locks')
  },
}
